const logger = require('../utils/logger');
const { db } = require('../config/database');
const path = require('path');

class SystemConfigService {
  /**
   * 获取配置值
   * @param {string} configKey - 配置键名
   * @returns {Promise<string|null>} 配置值
   */
  async getConfig(configKey) {
    try {
      const result = await db('system_configs')
        .where('config_key', configKey)
        .first();

      return result ? result.config_value : null;
    } catch (error) {
      logger.error(`获取配置失败 ${configKey}:`, error);
      throw error;
    }
  }

  /**
   * 获取完整配置对象
   * @param {string} configKey - 配置键名
   * @returns {Promise<Object|null>} 完整配置对象
   */
  async getFullConfig(configKey) {
    try {
      const result = await db('system_configs')
        .where('config_key', configKey)
        .first();

      return result || null;
    } catch (error) {
      logger.error(`获取完整配置失败 ${configKey}:`, error);
      throw error;
    }
  }

  /**
   * 获取最新的已发布配置
   * @param {string} configKey - 配置键名
   * @returns {Promise<Object|null>} 最新的已发布配置
   */
  async getLatestPublishedConfig(configKey) {
    try {
      // 按照目前逻辑，system_configs 表存储的就是当前活跃版本
      // 我们检查其状态是否为 published
      const config = await db('system_configs')
        .where({
          config_key: configKey,
          status: 'published'
        })
        .first();

      return config || null;
    } catch (error) {
      logger.error(`获取最新已发布配置失败 ${configKey}:`, error);
      throw error;
    }
  }

  /**
   * 获取多个配置值
   * @param {string[]} configKeys - 配置键名数组
   * @returns {Promise<Object>} 配置键值对对象
   */
  async getConfigs(configKeys) {
    try {
      const configs = await db('system_configs')
        .whereIn('config_key', configKeys)
        .select('config_key', 'config_value');

      const result = {};
      configs.forEach(config => {
        result[config.config_key] = config.config_value;
      });

      // 为不存在的配置设置默认值
      configKeys.forEach(key => {
        if (!(key in result)) {
          result[key] = null;
        }
      });

      return result;
    } catch (error) {
      logger.error(`获取多个配置失败:`, error);
      throw error;
    }
  }

  /**
   * 获取所有配置
   * @returns {Promise<Array>} 所有配置列表
   */
  async getAllConfigs() {
    try {
      const configs = await db('system_configs')
        .select('*')
        .orderBy('config_key');

      return configs;
    } catch (error) {
      logger.error('获取所有配置失败:', error);
      throw error;
    }
  }

  /**
   * 设置配置值（支持版本管理和文件存储）
   * @param {string} configKey - 配置键名
   * @param {string} configValue - 配置值
   * @param {string} configType - 配置类型 (text, html, json, file)
   * @param {string} description - 配置描述
   * @param {number} updatedBy - 更新者ID
   * @param {string} updateReason - 更新原因
   * @param {string} versionNumber - 版本号
   * @param {Date} effectiveDate - 生效日期
   * @param {string} status - 状态 (draft, published, archived)
   * @param {Object} fileInfo - 文件信息 { filePath, fileName, fileType, fileSize, fileUrl }
   * @param {Object} existingTrx -现有事务 (可选)
   * @returns {Promise<boolean>} 是否更新成功
   */
  async setConfig(configKey, configValue, configType = 'text', description = null, updatedBy = null, updateReason = null, versionNumber = null, effectiveDate = null, status = 'draft', fileInfo = null, existingTrx = null) {
    const trx = existingTrx || await db.transaction();

    try {
      // 获取当前配置值用于历史记录
      const currentConfig = await trx('system_configs')
        .where('config_key', configKey)
        .first();

      const oldValue = currentConfig ? currentConfig.config_value : null;
      const oldVersion = currentConfig ? currentConfig.version_number : null;
      const oldStatus = currentConfig ? currentConfig.status : null;
      const oldFilePath = currentConfig ? currentConfig.file_path : null;

      // 准备配置数据
      const configData = {
        config_key: configKey,
        config_value: configValue,
        config_type: configType,
        description: description,
        updated_by: updatedBy,
        version_number: versionNumber,
        effective_date: effectiveDate,
        status: status,
        updated_at: new Date()
      };

      // 如果有文件信息，添加文件相关字段
      if (fileInfo) {
        configData.file_path = fileInfo.filePath;
        configData.file_name = fileInfo.fileName;
        configData.file_type = fileInfo.fileType;
        configData.file_size = fileInfo.fileSize;
        configData.file_url = fileInfo.fileUrl;
      }

      // 插入或更新配置
      await trx('system_configs')
        .insert(configData)
        .onConflict('config_key')
        .merge(configData);

      // 记录历史变更
      if (oldValue !== configValue || oldVersion !== versionNumber || oldStatus !== status || oldFilePath !== (fileInfo ? fileInfo.filePath : null)) {
        const historyData = {
          config_key: configKey,
          old_value: oldValue,
          new_value: configValue,
          updated_by: updatedBy,
          update_reason: updateReason,
          version_number: versionNumber,
          status: status,
          created_at: new Date(),
          updated_at: new Date()
        };

        // 如果有文件信息，添加到历史记录
        if (fileInfo) {
          historyData.file_path = fileInfo.filePath;
          historyData.file_name = fileInfo.fileName;
        }

        await trx('system_config_history').insert(historyData);
      }

      if (!existingTrx) await trx.commit();

      logger.info(`配置更新成功: ${configKey}`, {
        oldValue: oldValue,
        newValue: configValue,
        version: versionNumber,
        status: status,
        updatedBy: updatedBy
      });

      return true;
    } catch (error) {
      if (!existingTrx) await trx.rollback();
      logger.error(`设置配置失败 ${configKey}:`, error);
      throw error;
    }
  }

  /**
   * 发布草稿配置 (Draft -> Published)
   * @param {string} baseKey - 主配置键名 (不含 _draft 后缀)
   * @param {number} userId - 发布者ID
   * @param {string} publishReason - 发布原因
   * @returns {Promise<Object>} 发布结果
   */
  async publishDraft(baseKey, userId, publishReason = 'User published draft') {
    const trx = await db.transaction();
    const draftKey = `${baseKey}_draft`;

    try {
      // 1. 获取草稿内容
      const draftConfig = await trx('system_configs')
        .where('config_key', draftKey)
        .first();

      if (!draftConfig) {
        throw new Error('Draft configuration not found');
      }

      // 1.5 Snapshot current live version to history BEFORE overwriting
      // This ensures we have a record of the "Old" version that is being replaced/archived
      const currentLiveConfig = await trx('system_configs')
        .where('config_key', baseKey)
        .first();

      if (currentLiveConfig) {
        // Create a history record representing the state of the config BEFORE this update
        // We use the original 'updated_at' as 'created_at' to place it correctly in the timeline
        await trx('system_config_history').insert({
          config_key: baseKey,
          old_value: currentLiveConfig.config_value, // Snapshot of value
          new_value: currentLiveConfig.config_value, // Snapshot of value
          version_number: currentLiveConfig.version_number,
          file_name: currentLiveConfig.file_name,
          file_path: currentLiveConfig.file_path,
          updated_by: currentLiveConfig.updated_by,
          update_reason: currentLiveConfig.update_reason || 'Archived automatically upon new release', // Preserve original reason
          status: 'published', // It was a published version
          created_at: currentLiveConfig.updated_at || new Date(), // Use original timestamp
          updated_at: new Date()
        });
      }

      // 2. 准备文件信息对象 (如果草稿有文件)
      let fileInfo = null;
      if (draftConfig.file_url) {
        fileInfo = {
          filePath: draftConfig.file_path,
          fileName: draftConfig.file_name,
          fileType: draftConfig.file_type,
          fileSize: draftConfig.file_size,
          fileUrl: draftConfig.file_url
        };
      }

      // 3. 将草稿内容写入主 Key，状态设为 published
      // 复用 setConfig 逻辑，并在其中记录历史 (历史表将包含旧的主 Key 内容作为 old_value)
      // 注意: 这里传入 existingTrx 以保持在同一事务中
      await this.setConfig(
        baseKey,
        draftConfig.config_value,
        draftConfig.config_type,
        draftConfig.description,
        userId,
        publishReason,
        draftConfig.version_number,
        draftConfig.effective_date,
        'published', // 强制设为 published
        fileInfo,
        trx
      );

      // 4. 删除草稿记录 (或者保留，这里选择保留但清空内容? 不，直接删除以清理 _draft 记录)
      await trx('system_configs')
        .where('config_key', draftKey)
        .del();

      await trx.commit();
      logger.info(`Draft published successfully: ${draftKey} -> ${baseKey}`);
      return { success: true };

    } catch (error) {
      await trx.rollback();
      logger.error(`Failed to publish draft ${draftKey}:`, error);
      throw error;
    }
  }

  /**
   * 删除配置
   * @param {string} configKey - 配置键名
   * @param {number} deletedBy - 删除者ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteConfig(configKey, deletedBy = null) {
    const trx = await db.transaction();

    try {
      // 获取当前配置值用于历史记录
      const currentConfig = await trx('system_configs')
        .where('config_key', configKey)
        .first();

      if (!currentConfig) {
        await trx.rollback();
        return false;
      }

      // 删除配置
      await trx('system_configs')
        .where('config_key', configKey)
        .del();

      // 记录历史变更
      await trx('system_config_history').insert({
        config_key: configKey,
        old_value: currentConfig.config_value,
        new_value: null,
        updated_by: deletedBy,
        update_reason: '配置已删除',
        created_at: new Date(),
        updated_at: new Date()
      });

      await trx.commit();

      logger.info(`配置删除成功: ${configKey}`, {
        deletedBy: deletedBy
      });

      return true;
    } catch (error) {
      await trx.rollback();
      logger.error(`删除配置失败 ${configKey}:`, error);
      throw error;
    }
  }

  /**
   * 获取配置历史记录
   * @param {string} configKey - 配置键名 (可选)
   * @param {number} limit - 限制条数
   * @param {number} offset - 偏移量
   * @param {boolean} onlyArchived - 是否只获取归档记录 (status='published' 的历史记录)
   * @returns {Promise<Array>} 历史记录列表
   */
  async getConfigHistory(configKey = null, limit = 50, offset = 0, onlyArchived = false) {
    try {
      let query = db('system_config_history')
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      if (configKey) {
        query = query.where('config_key', configKey);
      }

      // 如果只查询归档记录，我们查找那些状态为 'published' 的历史记录
      // 这代表了曾经发布过的版本
      if (onlyArchived) {
        query = query.where('status', 'published');
      }

      const history = await query;

      // 获取用户信息
      const userIds = [...new Set(history.map(h => h.updated_by).filter(Boolean))];
      const users = userIds.length > 0 ? await db('users')
        .whereIn('id', userIds)
        .select('id', 'username', 'display_name') : [];

      const userMap = {};
      users.forEach(user => {
        userMap[user.id] = user;
      });

      // 添加用户信息到历史记录，并构建 file_url
      return history.map(record => {
        // Reconstruct file_url if file_path exists but file_url column is missing/empty
        let fileUrl = record.file_url;
        if (!fileUrl && record.file_path) {
          const fileName = path.basename(record.file_path);
          fileUrl = `/uploads/legal-documents/${fileName}`;
        }

        return {
          ...record,
          file_url: fileUrl,
          updated_by_user: record.updated_by ? userMap[record.updated_by] || null : null
        };
      });
    } catch (error) {
      logger.error('获取配置历史失败:', error);
      throw error;
    }
  }

  /**
   * 初始化默认配置
   */
  async initializeDefaultConfigs() {
    const defaultConfigs = [
      {
        config_key: 'user_agreement',
        config_value: '',
        config_type: 'html',
        description: '用户协议'
      },
      {
        config_key: 'privacy_policy',
        config_value: '',
        config_type: 'html',
        description: '隐私政策'
      },
      {
        config_key: 'about_us',
        config_value: '',
        config_type: 'html',
        description: '关于我们'
      },
      {
        config_key: 'contact_info',
        config_value: '',
        config_type: 'html',
        description: '联系方式'
      }
    ];

    try {
      for (const config of defaultConfigs) {
        await this.setConfig(
          config.config_key,
          config.config_value,
          config.config_type,
          config.description
        );
      }

      logger.info('默认配置初始化完成');
    } catch (error) {
      logger.error('初始化默认配置失败:', error);
      throw error;
    }
  }
}

module.exports = new SystemConfigService();