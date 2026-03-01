const { db } = require('./src/config/database');

async function checkConfigs() {
    try {
        const configs = await db('system_configs').select('*');
        console.log('--- System Configs ---');
        configs.forEach(c => {
            console.log(`Key: ${c.config_key}`);
            console.log(`Type: ${c.config_type}`);
            console.log(`Status: ${c.status}`);
            console.log(`File URL: ${c.file_url}`);
            console.log(`Value snippet: ${c.config_value ? c.config_value.substring(0, 100) + '...' : 'null'}`);
            console.log('-------------------');
        });
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkConfigs();
