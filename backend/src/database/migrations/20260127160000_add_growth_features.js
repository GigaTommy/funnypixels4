
exports.up = async function (knex) {
    // 1. Modify pixels table
    const hasPhotoUrl = await knex.schema.hasColumn('pixels', 'photo_url');
    if (!hasPhotoUrl) {
        await knex.schema.alterTable('pixels', table => {
            table.string('photo_url', 512);
            table.boolean('is_public').defaultTo(false);
        });
    }

    // 2. Insert Achievements
    // We use insert().onConflict('key').merge() if 'key' exists, 
    // but looking at previous migration, there isn't a unique 'key' constraint explicitly shown other than the primary key maybe?
    // Let's assume name is unique or we just insert. To be safe, we check existence.

    const achievements = [
        {
            name: 'Pixel Novice',
            description: 'Draw 10 pixels',
            icon_url: 'https://funnypixels.com/assets/badges/novice.png',
            reward_points: 10,
            type: 'milestone',
            requirement: 10,
            repeat_cycle: 'permanent',
            is_active: true
        },
        {
            name: 'Pixel Artist',
            description: 'Draw 100 pixels',
            icon_url: 'https://funnypixels.com/assets/badges/artist.png',
            reward_points: 50,
            type: 'milestone',
            requirement: 100,
            repeat_cycle: 'permanent',
            is_active: true
        },
        {
            name: 'Pixel Master',
            description: 'Draw 1000 pixels',
            icon_url: 'https://funnypixels.com/assets/badges/master.png',
            reward_points: 200,
            type: 'milestone',
            requirement: 1000,
            repeat_cycle: 'permanent',
            is_active: true
        },
        {
            name: 'Social Butterfly',
            description: 'Check-in with a photo 5 times',
            icon_url: 'https://funnypixels.com/assets/badges/camera.png',
            reward_points: 30,
            type: 'action_count',
            requirement: 5,
            repeat_cycle: 'permanent',
            is_active: true
        }
    ];

    for (const achievement of achievements) {
        // Check if achievement with this name exists
        const existing = await knex('achievements').where({ name: achievement.name }).first();
        if (!existing) {
            await knex('achievements').insert(achievement);
        }
    }
};

exports.down = async function (knex) {
    // We generally don't delete data in down migrations unless created by schema
    const hasPhotoUrl = await knex.schema.hasColumn('pixels', 'photo_url');
    if (hasPhotoUrl) {
        await knex.schema.alterTable('pixels', table => {
            table.dropColumn('photo_url');
            table.dropColumn('is_public');
        });
    }
};
