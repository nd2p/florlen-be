const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres',
});

async function main() {
  await client.connect();
  console.log('Connected to local database successfully.');

  try {
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260530000004_voucher_users_junction.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration: 20260530000004_voucher_users_junction.sql');
    await client.query(sql);
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Error executing migration SQL:', err);
  } finally {
    await client.end();
    console.log('Connection closed.');
  }
}

main().catch(console.error);
