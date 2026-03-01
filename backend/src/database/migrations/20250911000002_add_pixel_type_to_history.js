/**
 * 为pixels_history表添加pixel_type和related_id字段
 * 与pixels表保持同步
 * @param {Knex} knex
 */
exports.up = function(knex) {
  return knex.raw(`
    -- 检查并添加pixel_type字段（如果不存在）
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pixels_history' 
        AND column_name = 'pixel_type'
      ) THEN
        ALTER TABLE pixels_history 
        ADD COLUMN pixel_type VARCHAR(20) DEFAULT 'basic';
        COMMENT ON COLUMN pixels_history.pixel_type IS '像素类型: basic/bomb/ad/alliance/event';
      END IF;
    END $$;
  `)
    .then(() => {
      return knex.raw(`
      -- 检查并添加related_id字段（如果不存在）
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'pixels_history' 
          AND column_name = 'related_id'
        ) THEN
          ALTER TABLE pixels_history 
          ADD COLUMN related_id UUID;
          COMMENT ON COLUMN pixels_history.related_id IS '关联的ID（如广告放置ID、炸弹ID等）';
        END IF;
      END $$;
    `);
    })
    .then(() => {
      return knex.raw(`
      -- 添加索引（如果不存在）
      CREATE INDEX IF NOT EXISTS idx_pixels_history_pixel_type 
      ON pixels_history (pixel_type);
      
      CREATE INDEX IF NOT EXISTS idx_pixels_history_pixel_type_related_id 
      ON pixels_history (pixel_type, related_id);
    `);
    })
    .then(() => {
      return knex.raw(`
      -- 添加约束（如果不存在）
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.check_constraints 
          WHERE constraint_name = 'chk_pixels_history_pixel_type'
        ) THEN
          ALTER TABLE pixels_history 
          ADD CONSTRAINT chk_pixels_history_pixel_type 
          CHECK (pixel_type IN ('basic', 'bomb', 'ad', 'alliance', 'event'));
        END IF;
      END $$;
    `);
    });
};

/**
 * 回滚迁移
 * @param {Knex} knex
 */
exports.down = function(knex) {
  return knex.raw(`
    -- 删除约束（如果存在）
    ALTER TABLE pixels_history DROP CONSTRAINT IF EXISTS chk_pixels_history_pixel_type;
  `)
    .then(() => {
      return knex.raw(`
      -- 删除索引（如果存在）
      DROP INDEX IF EXISTS idx_pixels_history_pixel_type;
      DROP INDEX IF EXISTS idx_pixels_history_pixel_type_related_id;
    `);
    })
    .then(() => {
      return knex.raw(`
      -- 删除字段（如果存在）
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'pixels_history' 
          AND column_name = 'pixel_type'
        ) THEN
          ALTER TABLE pixels_history DROP COLUMN pixel_type;
        END IF;
      END $$;
    `);
    })
    .then(() => {
      return knex.raw(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'pixels_history' 
          AND column_name = 'related_id'
        ) THEN
          ALTER TABLE pixels_history DROP COLUMN related_id;
        END IF;
      END $$;
    `);
    });
};
