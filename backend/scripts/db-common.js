const fs = require('node:fs');
const path = require('node:path');
const oracledb = require('oracledb');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    process.env[key] = process.env[key] || value;
  }
}

async function getConnection() {
  loadEnv();

  return oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: `${process.env.DB_HOST}:${process.env.DB_PORT || '1521'}/${process.env.DB_SERVICE}`,
  });
}

async function executeMany(connection, statements) {
  for (const statement of statements) {
    await connection.execute(statement);
  }
}

module.exports = {
  getConnection,
  executeMany,
};
