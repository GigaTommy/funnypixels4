/**
 * 调整成就体系结构以支持联盟熔炉、聚光灯社交与竞赛阶梯等多维玩法。
 *
 * - achievements 表补充成就类型、重复周期、数值需求、奖励配置等字段
 * - user_achievements 表补充完成与领取状态、时间戳，并增强唯一约束
 */
exports.up = async function up(knex) {
    // achievements 表结构升级
    const hasPoints = await knex.schema.hasColumn('achievements', 'points');
    if (hasPoints) {
      await knex.schema.alterTable('achievements', (table) => {
        table.renameColumn('points', 'reward_points');
      });
    }
  
    const addAchievementColumnIfMissing = async (column, builderFn) => {
      const exists = await knex.schema.hasColumn('achievements', column);
      if (!exists) {
        await knex.schema.alterTable('achievements', builderFn);
      }
    };
  
    await addAchievementColumnIfMissing('type', (table) => {
      table.string('type', 50).notNullable().defaultTo('milestone');
    });
  
    await addAchievementColumnIfMissing('requirement', (table) => {
      table.integer('requirement').notNullable().defaultTo(0);
    });
  
    await addAchievementColumnIfMissing('repeat_cycle', (table) => {
      table.string('repeat_cycle', 30).notNullable().defaultTo('permanent');
    });
  
    await addAchievementColumnIfMissing('reward_items', (table) => {
      table.jsonb('reward_items').notNullable().defaultTo(knex.raw('\'[]\'::jsonb'));
    });
  
    await addAchievementColumnIfMissing('reward_details', (table) => {
      table.jsonb('reward_details').notNullable().defaultTo(knex.raw('\'{}\'::jsonb'));
    });
  
    await addAchievementColumnIfMissing('metadata', (table) => {
      table.jsonb('metadata').notNullable().defaultTo(knex.raw('\'{}\'::jsonb'));
    });
  
    await addAchievementColumnIfMissing('display_priority', (table) => {
      table.integer('display_priority').notNullable().defaultTo(0);
    });
  
    await addAchievementColumnIfMissing('is_active', (table) => {
      table.boolean('is_active').notNullable().defaultTo(true);
    });
  
    const hasUpdatedAt = await knex.schema.hasColumn('achievements', 'updated_at');
    if (!hasUpdatedAt) {
      await knex.schema.alterTable('achievements', (table) => {
        table.timestamp('updated_at').defaultTo(knex.fn.now());
      });
    }
  
    // user_achievements 表结构升级
    const addUserColumnIfMissing = async (column, builderFn) => {
      const exists = await knex.schema.hasColumn('user_achievements', column);
      if (!exists) {
        await knex.schema.alterTable('user_achievements', builderFn);
      }
    };
  
    // progress 字段若不存在则补上，保证兼容旧库
    await addUserColumnIfMissing('progress', (table) => {
      table.integer('progress').notNullable().defaultTo(0);
    });
  
    await addUserColumnIfMissing('is_completed', (table) => {
      table.boolean('is_completed').notNullable().defaultTo(false);
    });
  
    await addUserColumnIfMissing('completed_at', (table) => {
      table.timestamp('completed_at');
    });
  
    await addUserColumnIfMissing('is_claimed', (table) => {
      table.boolean('is_claimed').notNullable().defaultTo(false);
    });
  
    await addUserColumnIfMissing('claimed_at', (table) => {
      table.timestamp('claimed_at');
    });
  
    const hasCreatedAt = await knex.schema.hasColumn('user_achievements', 'created_at');
    if (!hasCreatedAt) {
      const hasUnlockedAt = await knex.schema.hasColumn('user_achievements', 'unlocked_at');
      await knex.schema.alterTable('user_achievements', (table) => {
        if (hasUnlockedAt) {
          table.renameColumn('unlocked_at', 'created_at');
        } else {
          table.timestamp('created_at').defaultTo(knex.fn.now());
        }
        table.timestamp('updated_at').defaultTo(knex.fn.now());
      });
    } else {
      const hasUpdatedAtUser = await knex.schema.hasColumn('user_achievements', 'updated_at');
      if (!hasUpdatedAtUser) {
        await knex.schema.alterTable('user_achievements', (table) => {
          table.timestamp('updated_at').defaultTo(knex.fn.now());
        });
      }
    }
  
    // 保证唯一约束，避免重复记录
    const constraintName = 'user_achievements_user_id_achievement_id_unique';
    try {
      await knex.schema.alterTable('user_achievements', (table) => {
        table.unique(['user_id', 'achievement_id'], constraintName);
      });
    } catch (error) {
      // 重复添加唯一索引时忽略错误，保持幂等
      if (!/duplicate|exists/i.test(error.message)) {
        throw error;
      }
    }
  };
  
  exports.down = async function down(knex) {
    // 还原 user_achievements 表新增的结构
    const constraintName = 'user_achievements_user_id_achievement_id_unique';
    try {
      await knex.schema.alterTable('user_achievements', (table) => {
        table.dropUnique(['user_id', 'achievement_id'], constraintName);
      });
    } catch (error) {
      if (!/does not exist|undefined/i.test(error.message)) {
        throw error;
      }
    }
  
    const hasCreatedAt = await knex.schema.hasColumn('user_achievements', 'created_at');
    if (hasCreatedAt) {
      await knex.schema.alterTable('user_achievements', (table) => {
        table.dropColumn('updated_at');
        table.dropColumn('created_at');
      });
    }
  
    const hasUnlockedAt = await knex.schema.hasColumn('user_achievements', 'unlocked_at');
    if (!hasUnlockedAt) {
      await knex.schema.alterTable('user_achievements', (table) => {
        table.timestamp('unlocked_at').defaultTo(knex.fn.now());
      });
    }
  
    const dropUserColumns = ['progress', 'is_completed', 'completed_at', 'is_claimed', 'claimed_at'];
    for (const column of dropUserColumns) {
      const exists = await knex.schema.hasColumn('user_achievements', column);
      if (exists) {
        await knex.schema.alterTable('user_achievements', (table) => {
          table.dropColumn(column);
        });
      }
    }
  
    // 还原 achievements 表结构
    const dropAchievementColumns = ['type', 'requirement', 'repeat_cycle', 'reward_items', 'reward_details', 'metadata', 'display_priority', 'is_active', 'updated_at'];
    for (const column of dropAchievementColumns) {
      const exists = await knex.schema.hasColumn('achievements', column);
      if (exists) {
        await knex.schema.alterTable('achievements', (table) => {
          table.dropColumn(column);
        });
      }
    }
  
    const hasRewardPoints = await knex.schema.hasColumn('achievements', 'reward_points');
    if (hasRewardPoints) {
      await knex.schema.alterTable('achievements', (table) => {
        table.renameColumn('reward_points', 'points');
      });
    }
  };