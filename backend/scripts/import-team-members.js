const path = require('node:path');
const { randomUUID } = require('node:crypto');
const xlsx = require('../../node_modules/xlsx');
const { getConnection } = require('./db-common');

const defaultFilePath = path.resolve(__dirname, '..', 'imports', 'personnel-role-skill.xlsx');
const filePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultFilePath;

const requiredHeaders = ['姓名', '班组', '班次类型', '角色', '技能'];

function normalizeShiftType(value) {
  const text = String(value || '').trim();
  if (text === '早班/晚班') return '早晚班';
  return text;
}

function normalizeRole(value) {
  const text = String(value || '').trim();
  if (text.includes('班长')) return '组长';
  return text || '组员';
}

function parseSkills(value) {
  return String(value || '')
    .split(/[，,、/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readRows() {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headers = rows[0].map((header) => String(header).trim());

  for (const requiredHeader of requiredHeaders) {
    if (!headers.includes(requiredHeader)) {
      throw new Error(`Excel 缺少必填列：${requiredHeader}`);
    }
  }

  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));

  return rows.slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      name: String(row[headerIndex['姓名']] || '').trim(),
      team: String(row[headerIndex['班组']] || '').trim(),
      shiftType: normalizeShiftType(row[headerIndex['班次类型']]),
      role: normalizeRole(row[headerIndex['角色']]),
      skills: parseSkills(row[headerIndex['技能']]),
    }))
    .filter((row) => row.name);
}

async function findMemberByName(connection, name) {
  const result = await connection.execute(
    'SELECT ID FROM TEAM_MEMBER WHERE NAME = :name FETCH FIRST 1 ROWS ONLY',
    { name },
    { outFormat: 4002 },
  );
  return result.rows?.[0]?.ID ?? null;
}

async function main() {
  const rows = readRows();
  const connection = await getConnection();
  let inserted = 0;
  let updated = 0;

  try {
    for (const row of rows) {
      if (!row.team || !row.shiftType || !row.role) {
        throw new Error(`第 ${row.rowNumber} 行数据不完整`);
      }

      const existingId = await findMemberByName(connection, row.name);
      const memberId = existingId ?? randomUUID();

      if (existingId) {
        await connection.execute(
          `UPDATE TEAM_MEMBER
           SET TEAM = :team,
               SHIFT_TYPE = :shiftType,
               ROLE = :role,
               STATUS = '启用',
               UPDATED_AT = CURRENT_TIMESTAMP
           WHERE ID = :id`,
          {
            id: memberId,
            team: row.team,
            shiftType: row.shiftType,
            role: row.role,
          },
        );
        updated += 1;
      } else {
        await connection.execute(
          `INSERT INTO TEAM_MEMBER (ID, NAME, TEAM, SHIFT_TYPE, ROLE, STATUS)
           VALUES (:id, :name, :team, :shiftType, :role, '启用')`,
          {
            id: memberId,
            name: row.name,
            team: row.team,
            shiftType: row.shiftType,
            role: row.role,
          },
        );
        inserted += 1;
      }

      await connection.execute(
        'DELETE FROM TEAM_MEMBER_SKILL WHERE MEMBER_ID = :memberId',
        { memberId },
      );

      for (const skill of row.skills) {
        await connection.execute(
          `INSERT INTO TEAM_MEMBER_SKILL (ID, MEMBER_ID, SKILL_NAME)
           VALUES (:id, :memberId, :skillName)`,
          {
            id: randomUUID(),
            memberId,
            skillName: skill,
          },
        );
      }
    }

    await connection.commit();
    console.log(`Imported ${rows.length} rows from ${filePath}`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated: ${updated}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exitCode = 1;
});
