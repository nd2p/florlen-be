require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_CONNECTION_STRING =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function run() {
  console.log('Connecting to database:', DB_CONNECTION_STRING);
  const client = new Client({ connectionString: DB_CONNECTION_STRING });
  await client.connect();

  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260530000000_create_system_settings.sql');
    console.log('Reading migration file from:', migrationPath);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration query...');
    await client.query(sql);
    console.log('Migration applied successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

run();
