const TABLE_MATERIAL_ASSETS = 'material_assets';
const TABLE_MATERIAL_VARIANTS = 'material_variants';
const TABLE_PATTERN_ASSETS = 'pattern_assets';
const TABLE_TILE_SNAPSHOTS = 'tile_snapshots';

/**
 * @param { import('knex').Knex } knex
 */
exports.up = async function up(knex) {
  const hasMaterialAssets = await knex.schema.hasTable(TABLE_MATERIAL_ASSETS);
  if (!hasMaterialAssets) {
    await knex.schema.createTable(TABLE_MATERIAL_ASSETS, table => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('key', 128).notNullable().unique().comment('素材唯一键');
      table.string('display_name', 255).notNullable().comment('素材名称');
      table.string('material_type', 32).notNullable().comment('素材类型: standard_emoji, custom_sticker, color');
      table.string('source_type', 32).notNullable().comment('来源类型: unicode_font, upload, system');
      table.string('status', 32).notNullable().defaultTo('pending').comment('处理状态: pending, processing, ready, failed');
      table.string('unicode_codepoint', 32).nullable().comment('Unicode 码位');
      table.string('font_family', 128).nullable().comment('字体族 (标准 emoji)');
      table.integer('width').notNullable().defaultTo(0).comment('原始宽度');
      table.integer('height').notNullable().defaultTo(0).comment('原始高度');
      table.string('file_format', 32).nullable().comment('原始文件格式');
      table.bigInteger('file_size').notNullable().defaultTo(0).comment('原始文件大小');
      table.string('checksum', 128).nullable().comment('原始素材校验值');
      table.integer('version').notNullable().defaultTo(1).comment('素材版本号');
      table.timestamp('uploaded_at').defaultTo(knex.fn.now()).comment('上传时间');
      table.uuid('uploaded_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('processed_at').nullable().comment('处理完成时间');
      table.timestamp('failed_at').nullable().comment('处理失败时间');
      table.string('failure_reason', 512).nullable().comment('失败原因');
      table.jsonb('metadata').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
      table.timestamps(true, true);

      table.index(['material_type'], 'idx_material_assets_type');
      table.index(['status'], 'idx_material_assets_status');
      table.index(['unicode_codepoint'], 'idx_material_assets_unicode');
    });
  }

  const hasMaterialVariants = await knex.schema.hasTable(TABLE_MATERIAL_VARIANTS);
  if (!hasMaterialVariants) {
    await knex.schema.createTable(TABLE_MATERIAL_VARIANTS, table => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('material_id').notNullable().references('id').inTable(TABLE_MATERIAL_ASSETS).onDelete('CASCADE');
      table.string('variant_type', 32).notNullable().comment('变体类型: source, sprite_sheet, distance_field');
      table.string('format', 32).notNullable().comment('文件格式');
      table.integer('width').notNullable().defaultTo(0).comment('宽度');
      table.integer('height').notNullable().defaultTo(0).comment('高度');
      table.bigInteger('size_bytes').notNullable().defaultTo(0).comment('大小 (字节)');
      table.string('checksum', 128).nullable().comment('校验值');
      table.string('storage_key', 512).nullable().comment('对象存储 Key');
      table.text('payload').nullable().comment('内联 Base64 数据');
      table.jsonb('metadata').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
      table.integer('version').notNullable().defaultTo(1).comment('关联素材版本');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamps(true, true);

      table.index(['material_id', 'variant_type'], 'idx_material_variants_lookup');
      table.unique(['material_id', 'variant_type', 'version'], { indexName: 'uq_material_variant_version' });
    });
  }

  const hasMaterialColumns = await knex.schema.hasColumn(TABLE_PATTERN_ASSETS, 'material_id');
  if (!hasMaterialColumns) {
    await knex.schema.alterTable(TABLE_PATTERN_ASSETS, table => {
      table.uuid('material_id').nullable().references('id').inTable(TABLE_MATERIAL_ASSETS).onDelete('SET NULL');
      table.integer('material_version').notNullable().defaultTo(1);
      table.jsonb('material_metadata').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    });
  }

  // Note: tile_snapshots table alteration moved to separate migration 20250919130000
  // to ensure proper execution order after table creation
};

/**
 * @param { import('knex').Knex } knex
 */
exports.down = async function down(knex) {
  // Note: tile_snapshots table alteration rollback handled in separate migration 20250919130000

  const hasPatternMaterialColumns = await knex.schema.hasColumn(TABLE_PATTERN_ASSETS, 'material_id');
  if (hasPatternMaterialColumns) {
    await knex.schema.alterTable(TABLE_PATTERN_ASSETS, table => {
      table.dropColumn('material_metadata');
      table.dropColumn('material_version');
      table.dropColumn('material_id');
    });
  }

  const hasVariants = await knex.schema.hasTable(TABLE_MATERIAL_VARIANTS);
  if (hasVariants) {
    await knex.schema.dropTableIfExists(TABLE_MATERIAL_VARIANTS);
  }

  const hasAssets = await knex.schema.hasTable(TABLE_MATERIAL_ASSETS);
  if (hasAssets) {
    await knex.schema.dropTableIfExists(TABLE_MATERIAL_ASSETS);
  }
};
