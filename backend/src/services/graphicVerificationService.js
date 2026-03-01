const { db } = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class GraphicVerificationService {
  constructor() {
    // 挑战类型配置
    this.challengeTypes = {
      shape: {
        name: '形状识别',
        templates: [
          {
            question: '请选择所有的圆形',
            correctItems: ['circle', 'circle'],
            distractors: ['square', 'triangle', 'star', 'diamond']
          },
          {
            question: '请选择所有的三角形',
            correctItems: ['triangle', 'triangle'],
            distractors: ['circle', 'square', 'star', 'diamond']
          },
          {
            question: '请选择所有的正方形',
            correctItems: ['square', 'square'],
            distractors: ['circle', 'triangle', 'star', 'diamond']
          },
          {
            question: '请选择所有的星形',
            correctItems: ['star', 'star'],
            distractors: ['circle', 'triangle', 'square', 'diamond']
          }
        ]
      },
      color: {
        name: '颜色识别',
        templates: [
          {
            question: '请选择所有的红色物品',
            correctItems: ['🔴', '🍎', '🚗'],
            distractors: ['🔵', '🍊', '🚕', '🟢']
          },
          {
            question: '请选择所有的蓝色物品',
            correctItems: ['🔵', '🚙', '💙'],
            distractors: ['🔴', '🍎', '🚗', '🟢']
          },
          {
            question: '请选择所有的绿色物品',
            correctItems: ['🟢', '🥬', '🌲'],
            distractors: ['🔴', '🍎', '🚗', '🔵']
          },
          {
            question: '请选择所有的黄色物品',
            correctItems: ['🟡', '🍌', '⭐'],
            distractors: ['🔴', '🍎', '🚗', '🔵']
          }
        ]
      },
      object: {
        name: '物品识别',
        templates: [
          {
            question: '请选择所有的动物',
            correctItems: ['🐶', '🐱', '🐭'],
            distractors: ['🚗', '🏠', '🌳', '📱']
          },
          {
            question: '请选择所有的水果',
            correctItems: ['🍎', '🍌', '🍊'],
            distractors: ['🚗', '🏠', '🌳', '📱']
          },
          {
            question: '请选择所有的交通工具',
            correctItems: ['🚗', '✈️', '🚢'],
            distractors: ['🐶', '🍎', '🏠', '🌳']
          },
          {
            question: '请选择所有的建筑',
            correctItems: ['🏠', '🏢', '🏰'],
            distractors: ['🐶', '🍎', '🚗', '🌳']
          }
        ]
      },
      pattern: {
        name: '模式识别',
        templates: [
          {
            question: '请选择对称的图形',
            correctItems: ['symmetric_circle', 'symmetric_star'],
            distractors: ['asymmetric_triangle', 'irregular_shape']
          },
          {
            question: '请选择包含3个元素的图形',
            correctItems: ['three_dots', 'three_lines'],
            distractors: ['two_dots', 'four_lines', 'one_dot']
          }
        ]
      }
    };

    // 难度配置
    this.difficultyConfig = {
      easy: {
        timeLimit: 90,
        maxAttempts: 5,
        distractorCount: 2
      },
      medium: {
        timeLimit: 60,
        maxAttempts: 3,
        distractorCount: 3
      },
      hard: {
        timeLimit: 45,
        maxAttempts: 3,
        distractorCount: 4
      }
    };
  }

  /**
   * 创建图形验证挑战
   * @param {string} phone - 手机号
   * @param {object} options - 选项
   * @returns {Promise<object>}
   */
  async createChallenge(phone, options = {}) {
    try {
      const difficulty = options.difficulty || 'medium';
      const ipAddress = options.ipAddress;
      const userAgent = options.userAgent;

      // 检查是否有未完成的挑战
      const existingChallenge = await this.getPendingChallenge(phone);
      if (existingChallenge) {
        return existingChallenge;
      }

      // 随机选择挑战类型和模板
      const challengeType = this.selectRandomChallengeType();
      const template = this.selectRandomTemplate(challengeType);

      // 生成挑战选项
      const challengeOptions = this.generateChallengeOptions(template, difficulty);

      // 创建挑战记录
      const challengeData = {
        id: uuidv4(),
        phone: phone,
        type: challengeType,
        question: template.question,
        options: JSON.stringify(challengeOptions.options),
        correct_answer: challengeOptions.correctAnswer,
        time_limit: this.difficultyConfig[difficulty].timeLimit,
        difficulty: difficulty,
        attempt_count: 0,
        max_attempts: this.difficultyConfig[difficulty].maxAttempts,
        status: 'created',
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: new Date(Date.now() + this.difficultyConfig[difficulty].timeLimit * 1000),
        created_at: new Date(),
        updated_at: new Date()
      };

      await db('graphic_verification_challenges').insert(challengeData);

      logger.info('创建图形验证挑战', {
        challengeId: challengeData.id,
        phone,
        type: challengeType,
        difficulty
      });

      // 返回前端需要的格式（不包含正确答案）
      return {
        id: challengeData.id,
        type: challengeType,
        question: template.question,
        options: challengeOptions.options,
        timeLimit: challengeData.time_limit,
        difficulty: difficulty,
        expiresAt: challengeData.expires_at
      };

    } catch (error) {
      logger.error('创建图形验证挑战失败', {
        phone,
        error: error.message
      });
      throw new Error('创建验证挑战失败');
    }
  }

  /**
   * 验证用户答案
   * @param {string} challengeId - 挑战ID
   * @param {string} answer - 用户答案
   * @param {object} options - 选项
   * @returns {Promise<object>}
   */
  async verifyAnswer(challengeId, answer, options = {}) {
    try {
      // 获取挑战记录
      const challenge = await db('graphic_verification_challenges')
        .where('id', challengeId)
        .first();

      if (!challenge) {
        return { valid: false, error: '挑战不存在' };
      }

      // 检查挑战状态
      if (challenge.used) {
        return { valid: false, error: '挑战已完成' };
      }

      // 检查是否过期
      if (new Date(challenge.expires_at) < new Date()) {
        await this.updateChallengeStatus(challengeId, 'expired');
        return { valid: false, error: '挑战已过期' };
      }

      // 检查尝试次数
      if (challenge.attempt_count >= challenge.max_attempts) {
        await this.updateChallengeStatus(challengeId, 'failed');
        return { valid: false, error: '尝试次数已达上限' };
      }

      // 更新尝试记录
      const userAnswers = challenge.user_answers ? JSON.parse(challenge.user_answers) : [];
      userAnswers.push({
        answer: answer,
        timestamp: new Date(),
        ipAddress: options.ipAddress
      });

      await db('graphic_verification_challenges')
        .where('id', challengeId)
        .update({
          attempt_count: challenge.attempt_count + 1,
          user_answers: JSON.stringify(userAnswers),
          last_attempt_at: new Date(),
          status: 'attempted',
          updated_at: new Date()
        });

      // 验证答案
      const isCorrect = answer === challenge.correct_answer;

      if (isCorrect) {
        // 验证成功
        await this.updateChallengeStatus(challengeId, 'passed');

        logger.info('图形验证挑战通过', {
          challengeId,
          phone: challenge.phone,
          attempts: challenge.attempt_count + 1
        });

        return { valid: true };
      } else {
        // 验证失败，检查是否还有剩余尝试次数
        const remainingAttempts = challenge.max_attempts - (challenge.attempt_count + 1);

        if (remainingAttempts <= 0) {
          await this.updateChallengeStatus(challengeId, 'failed');
          return { valid: false, error: '验证失败，尝试次数已用尽' };
        }

        return {
          valid: false,
          error: '答案不正确',
          remainingAttempts
        };
      }

    } catch (error) {
      logger.error('验证图形答案失败', {
        challengeId,
        answer,
        error: error.message
      });
      return { valid: false, error: '服务器内部错误' };
    }
  }

  /**
   * 获取待处理的挑战
   * @param {string} phone - 手机号
   * @returns {Promise<object|null>}
   */
  async getPendingChallenge(phone) {
    try {
      const challenge = await db('graphic_verification_challenges')
        .where({
          phone: phone,
          used: false
        })
        .where('expires_at', '>', new Date())
        .whereNot('status', 'expired')
        .whereNot('status', 'failed')
        .orderBy('created_at', 'desc')
        .first();

      if (!challenge) {
        return null;
      }

      return {
        id: challenge.id,
        type: challenge.type,
        question: challenge.question,
        options: JSON.parse(challenge.options),
        timeLimit: challenge.time_limit,
        difficulty: challenge.difficulty,
        expiresAt: challenge.expires_at
      };

    } catch (error) {
      logger.error('获取待处理挑战失败', {
        phone,
        error: error.message
      });
      return null;
    }
  }

  /**
   * 随机选择挑战类型
   * @returns {string}
   */
  selectRandomChallengeType() {
    const types = Object.keys(this.challengeTypes);
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * 随机选择模板
   * @param {string} challengeType - 挑战类型
   * @returns {object}
   */
  selectRandomTemplate(challengeType) {
    const templates = this.challengeTypes[challengeType].templates;
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * 生成挑战选项
   * @param {object} template - 模板
   * @param {string} difficulty - 难度
   * @returns {object}
   */
  generateChallengeOptions(template, difficulty) {
    const distractorCount = this.difficultyConfig[difficulty].distractorCount;
    const allItems = [...template.correctItems, ...template.distractors];

    // 随机选择干扰项
    const selectedDistractors = this.shuffleArray(template.distractors)
      .slice(0, distractorCount);

    // 合并正确答案和干扰项
    const allOptions = [...template.correctItems, ...selectedDistractors];

    // 打乱顺序
    const shuffledOptions = this.shuffleArray(allOptions);

    // 生成选项对象
    const options = shuffledOptions.map((item, index) => ({
      id: `option_${index}`,
      content: item,
      label: this.getItemLabel(item)
    }));

    // 找到正确答案的ID
    const correctOption = options.find(opt => template.correctItems.includes(opt.content));
    const correctAnswer = correctOption ? correctOption.id : null;

    return {
      options: options,
      correctAnswer: correctAnswer
    };
  }

  /**
   * 获取项目标签
   * @param {string} item - 项目内容
   * @returns {string}
   */
  getItemLabel(item) {
    const labels = {
      'circle': '圆形',
      'triangle': '三角形',
      'square': '正方形',
      'star': '星形',
      'diamond': '菱形',
      '🔴': '红色圆',
      '🔵': '蓝色圆',
      '🟢': '绿色圆',
      '🟡': '黄色圆',
      '🍎': '苹果',
      '🍌': '香蕉',
      '🍊': '橘子',
      '🥬': '蔬菜',
      '🌲': '树木',
      '💙': '蓝心',
      '🚗': '汽车',
      '🚙': 'SUV',
      '🚕': '出租车',
      '✈️': '飞机',
      '🚢': '轮船',
      '🐶': '小狗',
      '🐱': '小猫',
      '🐭': '老鼠',
      '🏠': '房子',
      '🏢': '大楼',
      '🏰': '城堡',
      '🌳': '大树',
      '📱': '手机',
      '⭐': '星星',
      'symmetric_circle': '对称圆形',
      'symmetric_star': '对称星形',
      'asymmetric_triangle': '不对称三角形',
      'irregular_shape': '不规则形状',
      'three_dots': '三个点',
      'three_lines': '三条线',
      'two_dots': '两个点',
      'four_lines': '四条线',
      'one_dot': '一个点'
    };
    return labels[item] || item;
  }

  /**
   * 打乱数组
   * @param {array} array - 数组
   * @returns {array}
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * 更新挑战状态
   * @param {string} challengeId - 挑战ID
   * @param {string} status - 状态
   * @returns {Promise<void>}
   */
  async updateChallengeStatus(challengeId, status) {
    const updateData = {
      status: status,
      updated_at: new Date()
    };

    if (status === 'passed' || status === 'failed') {
      updateData.used = true;
      updateData.completed_at = new Date();
    }

    await db('graphic_verification_challenges')
      .where('id', challengeId)
      .update(updateData);
  }

  /**
   * 清理过期的挑战
   * @returns {Promise<number>} 删除的记录数
   */
  async cleanExpiredChallenges() {
    try {
      const result = await db('graphic_verification_challenges')
        .where('expires_at', '<', new Date())
        .orWhere('used', true)
        .where('created_at', '<', new Date(Date.now() - 24 * 60 * 60 * 1000)) // 24小时前的已完成记录
        .del();

      if (result > 0) {
        logger.info('清理过期图形验证挑战', { count: result });
      }

      return result;
    } catch (error) {
      logger.error('清理过期图形验证挑战失败', { error: error.message });
      return 0;
    }
  }

  /**
   * 获取挑战统计信息
   * @param {string} phone - 手机号（可选）
   * @returns {Promise<object>}
   */
  async getChallengeStats(phone = null) {
    try {
      let query = db('graphic_verification_challenges');

      if (phone) {
        query = query.where('phone', phone);
      }

      const stats = await query
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('SUM(CASE WHEN status = "passed" THEN 1 ELSE 0 END) as passed'),
          db.raw('SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed'),
          db.raw('SUM(CASE WHEN status = "expired" THEN 1 ELSE 0 END) as expired'),
          db.raw('AVG(attempt_count) as avg_attempts')
        )
        .first();

      return {
        total: parseInt(stats.total) || 0,
        passed: parseInt(stats.passed) || 0,
        failed: parseInt(stats.failed) || 0,
        expired: parseInt(stats.expired) || 0,
        successRate: stats.total > 0 ? (stats.passed / stats.total * 100).toFixed(2) + '%' : '0%',
        avgAttempts: parseFloat(stats.avg_attempts || 0).toFixed(2)
      };

    } catch (error) {
      logger.error('获取挑战统计信息失败', { phone, error: error.message });
      return {
        total: 0,
        passed: 0,
        failed: 0,
        expired: 0,
        successRate: '0%',
        avgAttempts: '0'
      };
    }
  }
}

module.exports = new GraphicVerificationService();