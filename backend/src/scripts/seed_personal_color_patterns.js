/**
 * 生成并插入16个 PersonalColorPalette 颜色到 pattern_assets 表
 * 这些是个人颜色模式使用的标准颜色（与 iOS PersonalColorPalette.colors 保持一致）
 */

// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';

const { db } = require('../config/database');

// PersonalColorPalette 16色（与 iOS FlagChoice.swift 中的 PersonalColorPalette.colors 完全一致）
const personalColors = [
    { hex: '#E53E3E', name: '个人红' },
    { hex: '#DD6B20', name: '个人橙' },
    { hex: '#D69E2E', name: '个人黄' },
    { hex: '#38A169', name: '个人绿' },
    { hex: '#319795', name: '个人青绿' },
    { hex: '#3182CE', name: '个人蓝' },
    { hex: '#5A67D8', name: '个人靛蓝' },
    { hex: '#805AD5', name: '个人紫' },
    { hex: '#D53F8C', name: '个人粉' },
    { hex: '#C53030', name: '个人深红' },
    { hex: '#2D3748', name: '个人深灰' },
    { hex: '#744210', name: '个人棕' },
    { hex: '#276749', name: '个人深绿' },
    { hex: '#2A4365', name: '个人深蓝' },
    { hex: '#553C9A', name: '个人深紫' },
    { hex: '#97266D', name: '个人玫红' },
    { hex: '#4ECDC4', name: '默认绿色' },  // 系统默认fallback颜色，与iOS前端一致
];

async function seedPersonalColorPatterns() {
    try {
        console.log('🎨 开始插入 PersonalColorPalette 16色 Pattern...\n');

        // 检查数据库连接
        await db.raw('SELECT 1');
        console.log('✅ 数据库连接成功\n');

        let totalInserted = 0;
        let totalSkipped = 0;

        for (const color of personalColors) {
            const key = `personal_color_${color.hex.replace('#', '').toLowerCase()}`;

            try {
                const existing = await db('pattern_assets').where('key', key).first();
                if (existing) {
                    console.log(`  ⏭️  ${key.padEnd(30)} 已存在`);
                    totalSkipped++;
                } else {
                    await db('pattern_assets').insert({
                        key,
                        name: color.name,
                        description: `个人调色板颜色: ${color.hex}`,
                        category: 'personal_color',
                        render_type: 'color',
                        color: color.hex,
                        encoding: 'color',
                        payload: JSON.stringify({ color: color.hex, type: 'color' }),
                        tags: ['personal', 'color', 'palette'],
                        is_public: true,
                        width: 32,
                        height: 32,
                        verified: true,
                        created_at: new Date(),
                        updated_at: new Date()
                    });
                    console.log(`  ✅ ${key.padEnd(30)} ${color.name} (${color.hex})`);
                    totalInserted++;
                }
            } catch (err) {
                console.error(`  ❌ ${key.padEnd(30)} 错误: ${err.message}`);
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ PersonalColorPalette 插入完成!');
        console.log('='.repeat(50));
        console.log(`  新插入: ${totalInserted}`);
        console.log(`  已存在: ${totalSkipped}`);
        console.log(`  总计: ${personalColors.length}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ 插入失败:', error);
        process.exit(1);
    }
}

seedPersonalColorPatterns();
