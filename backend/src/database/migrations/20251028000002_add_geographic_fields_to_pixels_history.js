/**
 * Add missing geographic fields to pixels_history partitioned table
 * This migration ensures pixels_history has the same geographic structure as pixels table
 *
 * IMPORTANT: For partitioned tables, columns must be added to the parent table first,
 * then partitions will inherit them automatically. We cannot alter partitions directly.
 */

exports.up = async function(knex) {
  try {
    // Check if pixels_history table exists and is partitioned
    const tableCheck = await knex.raw(`
      SELECT
        t.relname AS table_name,
        c.relkind AS partition_kind
      FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      LEFT JOIN pg_inherits i ON i.inhrelid = t.oid
      LEFT JOIN pg_class c ON c.oid = i.inhparent
      WHERE t.relname = 'pixels_history'
      AND n.nspname = 'public'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('✅ pixels_history table does not exist, skipping migration');
      return;
    }

    const isPartitioned = tableCheck.rows[0].partition_kind === 'p';

    if (isPartitioned) {
      console.log('📋 Detected partitioned pixels_history table, adding columns to parent table...');

      // For partitioned tables, we need to add columns to the parent table only
      // Partitions will inherit the columns automatically
      await knex.raw(`
        ALTER TABLE pixels_history
        ADD COLUMN IF NOT EXISTS country VARCHAR(100),
        ADD COLUMN IF NOT EXISTS province VARCHAR(100),
        ADD COLUMN IF NOT EXISTS city VARCHAR(100),
        ADD COLUMN IF NOT EXISTS district VARCHAR(100),
        ADD COLUMN IF NOT EXISTS adcode VARCHAR(20),
        ADD COLUMN IF NOT EXISTS formatted_address TEXT,
        ADD COLUMN IF NOT EXISTS geocoded BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP
      `);

      console.log('✅ Columns added to parent partitioned table successfully');

    } else {
      console.log('📋 Regular table detected, adding columns directly...');

      // For regular tables, add columns as usual
      await knex.raw(`
        ALTER TABLE pixels_history
        ADD COLUMN IF NOT EXISTS country VARCHAR(100),
        ADD COLUMN IF NOT EXISTS province VARCHAR(100),
        ADD COLUMN IF NOT EXISTS city VARCHAR(100),
        ADD COLUMN IF NOT EXISTS district VARCHAR(100),
        ADD COLUMN IF NOT EXISTS adcode VARCHAR(20),
        ADD COLUMN IF NOT EXISTS formatted_address TEXT,
        ADD COLUMN IF NOT EXISTS geocoded BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP
      `);
    }

    // Add comments for documentation (these work for both partitioned and regular tables)
    await knex.raw(`COMMENT ON COLUMN pixels_history.country IS '国家名称'`);
    await knex.raw(`COMMENT ON COLUMN pixels_history.province IS '省份名称'`);
    await knex.raw(`COMMENT ON COLUMN pixels_history.city IS '城市名称'`);
    await knex.raw(`COMMENT ON COLUMN pixels_history.district IS '区域名称'`);
    await knex.raw(`COMMENT ON COLUMN pixels_history.adcode IS '行政区划代码'`);
    await knex.raw(`COMMENT ON COLUMN pixels_history.formatted_address IS '格式化地址'`);
    await knex.raw(`COMMENT ON COLUMN pixels_history.geocoded IS '是否已地理编码'`);
    await knex.raw(`COMMENT ON COLUMN pixels_history.geocoded_at IS '地理编码时间'`);

    // Update existing records with default values for better data integrity
    await knex.raw(`
      UPDATE pixels_history
      SET
        geocoded = FALSE,
        geocoded_at = created_at
      WHERE geocoded IS NULL
    `);

    // Create indexes for better query performance on geographic fields
    // Note: These indexes will be created on the parent table and apply to all partitions
    try {
      await knex.raw(`CREATE INDEX IF NOT EXISTS idx_pixels_history_city ON pixels_history(city) WHERE city IS NOT NULL`);
      await knex.raw(`CREATE INDEX IF NOT EXISTS idx_pixels_history_country ON pixels_history(country) WHERE country IS NOT NULL`);
      await knex.raw(`CREATE INDEX IF NOT EXISTS idx_pixels_history_geocoded ON pixels_history(geocoded)`);

      // Add composite index for time-based geographic queries
      await knex.raw(`CREATE INDEX IF NOT EXISTS idx_pixels_history_time_geo ON pixels_history(created_at, city) WHERE city IS NOT NULL`);

      console.log('✅ Geographic indexes created successfully');
    } catch (indexError) {
      console.warn('⚠️ Warning: Some indexes could not be created:', indexError.message);
      // Continue even if indexes fail, as the main goal is to add columns
    }

    // Verify that partitions have inherited the new columns
    if (isPartitioned) {
      const partitionTables = await knex.raw(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE 'pixels_history_%'
        ORDER BY tablename
      `);

      console.log(`🔍 Verifying ${partitionTables.rows.length} partition tables...`);

      for (const table of partitionTables.rows) {
        const partitionTable = table.tablename;

        // Check if the partition has the new columns
        const columnCheck = await knex.raw(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = '${partitionTable}'
          AND table_schema = 'public'
          AND column_name IN ('country', 'province', 'city', 'district', 'adcode', 'formatted_address', 'geocoded', 'geocoded_at')
        `);

        if (columnCheck.rows.length === 8) {
          console.log(`✅ Partition ${partitionTable} has inherited all new columns`);
        } else {
          console.warn(`⚠️ Warning: Partition ${partitionTable} may not have all columns (${columnCheck.rows.length}/8 found)`);
        }
      }
    }

    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
};

exports.down = async function(knex) {
  try {
    // Check if table exists
    const tableExists = await knex.raw(`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'pixels_history'
      AND table_schema = 'public'
    `);

    if (tableExists.rows.length === 0) {
      console.log('✅ pixels_history table does not exist, skipping rollback');
      return;
    }

    // Remove indexes first (these will also remove from partitions)
    try {
      await knex.raw(`DROP INDEX IF EXISTS idx_pixels_history_city`);
      await knex.raw(`DROP INDEX IF EXISTS idx_pixels_history_country`);
      await knex.raw(`DROP INDEX IF EXISTS idx_pixels_history_geocoded`);
      await knex.raw(`DROP INDEX IF EXISTS idx_pixels_history_time_geo`);
      console.log('✅ Geographic indexes removed successfully');
    } catch (indexError) {
      console.warn('⚠️ Warning: Some indexes could not be dropped:', indexError.message);
    }

    // Remove columns from the parent table
    // For partitioned tables, this will also remove from all partitions
    await knex.raw(`
      ALTER TABLE pixels_history
      DROP COLUMN IF EXISTS country,
      DROP COLUMN IF EXISTS province,
      DROP COLUMN IF EXISTS city,
      DROP COLUMN IF EXISTS district,
      DROP COLUMN IF EXISTS adcode,
      DROP COLUMN IF EXISTS formatted_address,
      DROP COLUMN IF EXISTS geocoded,
      DROP COLUMN IF EXISTS geocoded_at
    `);

    console.log('✅ Geographic columns removed successfully');
    console.log('🎉 Rollback completed successfully!');

  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    throw error;
  }
};