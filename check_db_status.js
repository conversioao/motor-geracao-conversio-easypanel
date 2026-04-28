import { query } from './src/db.js';

async function checkDb() {
    try {
        console.log('Checking database tables...');
        const tables = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));

        console.log('\nChecking API Keys...');
        const keys = await query("SELECT id, provider, priority, status, is_active, RIGHT(key_secret, 4) as suffix FROM api_keys");
        console.table(keys.rows);

        console.log('\nChecking Admin Configs...');
        const configs = await query("SELECT key, value FROM admin_configs");
        console.table(configs.rows);
    } catch (err) {
        console.error('Database check failed:', err.message);
    }
}

checkDb();
