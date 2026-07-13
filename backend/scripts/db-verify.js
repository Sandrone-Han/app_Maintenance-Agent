const { getConnection } = require('./db-common');

const tables = [
  'TEAM_MEMBER',
  'TEAM_MEMBER_SKILL',
  'SHIFT_TYPE',
  'ATTENDANCE_RECORD',
  'TEAM_SCHEDULE_RECORD',
];

async function main() {
  const connection = await getConnection();

  try {
    for (const table of tables) {
      const result = await connection.execute(
        `SELECT COUNT(*) AS CNT FROM ${table}`,
        [],
        { outFormat: 4002 },
      );
      console.log(`${table}: ${result.rows?.[0]?.CNT ?? 0}`);
    }
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('Verify failed:', error);
  process.exitCode = 1;
});
