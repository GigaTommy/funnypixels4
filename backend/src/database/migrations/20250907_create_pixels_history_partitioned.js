/**
 * 创建 pixels_history 分区表
 * 用于记录所有像素操作的历史流水
 * 按日期分区，支持冷热数据分离
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 检查表是否已存在
  const tableExists = await knex.raw(`
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'pixels_history' 
    AND table_schema = 'public'
  `);
  
  if (tableExists.rows.length > 0) {
    console.log('✅ 表 pixels_history 已存在，跳过创建');
    return;
  }
  
  return knex.raw(`
    -- 创建主分区表
    CREATE TABLE pixels_history (
      id BIGSERIAL,
      latitude DECIMAL(10, 8) NOT NULL,
      longitude DECIMAL(11, 8) NOT NULL,
      color VARCHAR(7) NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      grid_id VARCHAR(50) NOT NULL,
      
      -- 图案相关字段
      pattern_id VARCHAR(100),
      pattern_anchor_x INTEGER DEFAULT 0,
      pattern_anchor_y INTEGER DEFAULT 0,
      pattern_rotation INTEGER DEFAULT 0,
      pattern_mirror BOOLEAN DEFAULT false,
      
      -- 历史记录特有字段
      history_date DATE NOT NULL,
      region_id INTEGER,
      action_type VARCHAR(20) DEFAULT 'draw',
      original_pixel_id BIGINT,
      version BIGINT DEFAULT 1,
      
      -- 时间戳
      created_at TIMESTAMP DEFAULT NOW(),
      
      -- 计算字段（用于索引优化）
      user_created_idx BIGINT,
      
      -- 主键
      PRIMARY KEY (id, history_date)
    ) PARTITION BY RANGE (history_date);
  `)
    .then(() => {
      return knex.raw(`
        -- 创建2025年1月的分区
        CREATE TABLE pixels_history_202501 PARTITION OF pixels_history
        FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
        
        -- 创建2025年2月的分区
        CREATE TABLE pixels_history_202502 PARTITION OF pixels_history
        FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
        
        -- 创建2025年3月的分区
        CREATE TABLE pixels_history_202503 PARTITION OF pixels_history
        FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
        
        -- 创建2025年4月的分区
        CREATE TABLE pixels_history_202504 PARTITION OF pixels_history
        FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
        
        -- 创建2025年5月的分区
        CREATE TABLE pixels_history_202505 PARTITION OF pixels_history
        FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
        
        -- 创建2025年6月的分区
        CREATE TABLE pixels_history_202506 PARTITION OF pixels_history
        FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
        
        -- 创建2025年7月的分区
        CREATE TABLE pixels_history_202507 PARTITION OF pixels_history
        FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
        
        -- 创建2025年8月的分区
        CREATE TABLE pixels_history_202508 PARTITION OF pixels_history
        FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
        
        -- 创建2025年9月的分区
        CREATE TABLE pixels_history_202509 PARTITION OF pixels_history
        FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
        
        -- 创建2025年10月的分区
        CREATE TABLE pixels_history_202510 PARTITION OF pixels_history
        FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
        
        -- 创建2025年11月的分区
        CREATE TABLE pixels_history_202511 PARTITION OF pixels_history
        FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
        
        -- 创建2025年12月的分区
        CREATE TABLE pixels_history_202512 PARTITION OF pixels_history
        FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
      `);
    })
    .then(() => {
      return knex.raw(`
        -- 用户行为分析索引
        CREATE INDEX idx_pixels_history_user_created 
        ON pixels_history (user_id, created_at DESC);
        
        -- 像素历史回溯索引
        CREATE INDEX idx_pixels_history_grid_created 
        ON pixels_history (grid_id, created_at DESC);
        
        -- 日期范围查询索引
        CREATE INDEX idx_pixels_history_date 
        ON pixels_history (history_date DESC);
        
        -- 复合查询索引
        CREATE INDEX idx_pixels_history_user_date_action 
        ON pixels_history (user_id, history_date, action_type);
        
        -- 区域查询索引
        CREATE INDEX idx_pixels_history_region_date 
        ON pixels_history (region_id, history_date DESC) 
        WHERE region_id IS NOT NULL;
        
        -- 操作类型索引
        CREATE INDEX idx_pixels_history_action_type 
        ON pixels_history (action_type, created_at DESC);
      `);
    })
    .then(() => {
      return knex.raw(`
        -- 创建自动分区管理函数
        CREATE OR REPLACE FUNCTION create_monthly_partition(table_name text, start_date date)
        RETURNS void AS $$
        DECLARE
            partition_name text;
            end_date date;
        BEGIN
            partition_name := table_name || '_' || to_char(start_date, 'YYYYMM');
            end_date := start_date + interval '1 month';
            
            EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
                            FOR VALUES FROM (%L) TO (%L)',
                           partition_name, table_name, start_date, end_date);
        END;
        $$ LANGUAGE plpgsql;
        
        -- 创建自动清理旧分区函数
        CREATE OR REPLACE FUNCTION cleanup_old_partitions(table_name text, keep_months integer DEFAULT 12)
        RETURNS void AS $$
        DECLARE
            partition_name text;
            cutoff_date date;
        BEGIN
            cutoff_date := CURRENT_DATE - (keep_months || ' months')::interval;
            
            -- 查找需要删除的分区
            FOR partition_name IN
                SELECT schemaname||'.'||tablename
                FROM pg_tables
                WHERE tablename LIKE table_name || '_%'
                AND tablename ~ '^' || table_name || '_[0-9]{6}$'
                AND to_date(substring(tablename from length(table_name) + 2), 'YYYYMM') < cutoff_date
            LOOP
                EXECUTE 'DROP TABLE IF EXISTS ' || partition_name;
                RAISE NOTICE 'Dropped partition: %', partition_name;
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;
        
        -- 创建数据归档函数
        CREATE OR REPLACE FUNCTION archive_old_pixels_history(archive_date date)
        RETURNS integer AS $$
        DECLARE
            archived_count integer;
        BEGIN
            -- 这里可以添加归档逻辑，比如导出到文件或外部存储
            -- 暂时只返回需要归档的记录数
            SELECT COUNT(*) INTO archived_count
            FROM pixels_history
            WHERE history_date < archive_date;
            
            RAISE NOTICE 'Found % records to archive before %', archived_count, archive_date;
            RETURN archived_count;
        END;
        $$ LANGUAGE plpgsql;
      `);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    // 删除函数
    .raw('DROP FUNCTION IF EXISTS create_monthly_partition(text, date)')
    .raw('DROP FUNCTION IF EXISTS cleanup_old_partitions(text, integer)')
    .raw('DROP FUNCTION IF EXISTS archive_old_pixels_history(date)')
    // 删除表（会自动删除所有分区）
    .dropTableIfExists('pixels_history');
};
