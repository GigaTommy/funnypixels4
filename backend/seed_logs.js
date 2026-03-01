const SystemLog = require('./src/models/SystemLog');
const { db } = require('./src/config/database');

async function sedLogs() {
    try {
        console.log('Generating mock logs...');

        const logs = [
            { level: 'info', module: 'auth', message: 'User admin logged in' },
            { level: 'warn', module: 'system', message: 'High memory usage detected' },
            { level: 'error', module: 'database', message: 'Connection timeout' },
            { level: 'debug', module: 'api', message: 'GET /api/admin/users called' },
            { level: 'info', module: 'user', message: 'User profile updated' }
        ];

        for (const log of logs) {
            await SystemLog.create(log);
        }

        console.log('Successfully generated 5 mock logs.');
        process.exit(0);
    } catch (error) {
        console.error('Failed to generate logs:', error);
        process.exit(1);
    }
}

sedLogs();
