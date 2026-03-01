/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasNotice = await knex.schema.hasColumn('alliances', 'notice');
    const hasBanner = await knex.schema.hasColumn('alliances', 'banner_url');
    const hasFlagType = await knex.schema.hasColumn('alliances', 'flag_type');
    const hasFlagColor = await knex.schema.hasColumn('alliances', 'flag_color');

    await knex.schema.alterTable('alliances', function (table) {
        if (!hasNotice) {
            table.text('notice').nullable().comment('联盟公告');
        }
        if (!hasBanner) {
            table.string('banner_url', 500).nullable().comment('联盟横幅URL');
        }
        if (!hasFlagType) {
            table.string('flag_type', 50).nullable().comment('旗帜类型');
        }
        if (!hasFlagColor) {
            table.string('flag_color', 20).nullable().comment('旗帜主颜色');
        }
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const hasNotice = await knex.schema.hasColumn('alliances', 'notice');
    const hasBanner = await knex.schema.hasColumn('alliances', 'banner_url');
    const hasFlagType = await knex.schema.hasColumn('alliances', 'flag_type');
    const hasFlagColor = await knex.schema.hasColumn('alliances', 'flag_color');

    await knex.schema.alterTable('alliances', function (table) {
        if (hasNotice) {
            table.dropColumn('notice');
        }
        if (hasBanner) {
            table.dropColumn('banner_url');
        }
        if (hasFlagType) {
            table.dropColumn('flag_type');
        }
        if (hasFlagColor) {
            table.dropColumn('flag_color');
        }
    });
};
