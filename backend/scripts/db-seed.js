const { getConnection } = require('./db-common');

const teamMembers = [
  { id: 'tm-001', name: '张工', team: 'A1', shiftType: '早晚班', role: '组长', skills: ['电工', '注塑维修'] },
  { id: 'tm-002', name: '李工', team: 'A1', shiftType: '早晚班', role: '组员', skills: ['电工'] },
  { id: 'tm-003', name: '王工', team: 'A1', shiftType: '早晚班', role: '组员', skills: ['注塑维修'] },
  { id: 'tm-004', name: '赵工', team: 'A1', shiftType: '早晚班', role: '组员', skills: ['钳工'] },
  { id: 'tm-005', name: '陈工', team: 'A2', shiftType: '早晚班', role: '组长', skills: ['注塑维修'] },
  { id: 'tm-006', name: '刘工', team: 'A2', shiftType: '早晚班', role: '组员', skills: ['电工'] },
  { id: 'tm-007', name: '周工', team: 'A2', shiftType: '早晚班', role: '组员', skills: ['钳工', '注塑维修'] },
  { id: 'tm-008', name: '吴工', team: 'A2', shiftType: '早晚班', role: '组员', skills: ['电工'] },
  { id: 'tm-009', name: '郑工', team: 'A3', shiftType: '早晚班', role: '组长', skills: ['钳工'] },
  { id: 'tm-010', name: '孙工', team: 'A3', shiftType: '早晚班', role: '组员', skills: ['电工', '注塑维修'] },
  { id: 'tm-011', name: '钱工', team: 'A3', shiftType: '早晚班', role: '组员', skills: ['注塑维修'] },
  { id: 'tm-012', name: '马工', team: 'A3', shiftType: '早晚班', role: '组员', skills: ['电工'] },
  { id: 'tm-013', name: '黄工', team: 'B', shiftType: '长白班', role: '组长', skills: ['电工', '注塑维修'] },
  { id: 'tm-014', name: '朱工', team: 'B', shiftType: '长白班', role: '组员', skills: ['钳工'] },
  { id: 'tm-015', name: '胡工', team: 'B', shiftType: '长白班', role: '组员', skills: ['注塑维修'] },
];

const shiftTypes = [
  { id: 'st-001', shiftCategory: '早晚班', scheduleRule: '上4休2', shiftName: '早班', startTime: '07:00', endTime: '19:00' },
  { id: 'st-002', shiftCategory: '早晚班', scheduleRule: '上4休2', shiftName: '晚班', startTime: '19:00', endTime: '07:00' },
  { id: 'st-003', shiftCategory: '长白班', scheduleRule: '上5休2', shiftName: '长白班', startTime: '08:00', endTime: '17:00' },
];

const attendanceRecords = [
  { id: 'ar-001', personName: '李工', team: 'A1', startDate: '2026-07-05', endDate: '2026-07-07', status: '休假' },
  { id: 'ar-002', personName: '周工', team: 'A2', startDate: '2026-07-08', endDate: '2026-07-08', status: '请假' },
];

const teamScheduleRecords = [
  { id: 'tsr-001', team: 'A1', type: '早晚班', currentShift: '早班', currentShiftDate: '2026-06-30', nextShift: '早班', nextShiftDate: '2026-07-01' },
  { id: 'tsr-002', team: 'A2', type: '早晚班', currentShift: '晚班', currentShiftDate: '2026-06-30', nextShift: '休息', nextShiftDate: '2026-07-01' },
  { id: 'tsr-003', team: 'A3', type: '早晚班', currentShift: '休息', currentShiftDate: '2026-06-30', nextShift: '早班', nextShiftDate: '2026-07-01' },
];

async function countRows(connection, tableName) {
  const result = await connection.execute(
    `SELECT COUNT(*) AS CNT FROM ${tableName}`,
    [],
    { outFormat: 4002 },
  );
  return Number(result.rows?.[0]?.CNT ?? 0);
}

async function main() {
  const connection = await getConnection();

  try {
    if ((await countRows(connection, 'TEAM_MEMBER')) > 0) {
      console.log('Seed skipped: TEAM_MEMBER already has data.');
      return;
    }

    for (const member of teamMembers) {
      await connection.execute(
        `INSERT INTO TEAM_MEMBER (ID, NAME, TEAM, SHIFT_TYPE, ROLE, STATUS)
         VALUES (:id, :name, :team, :shiftType, :role, '启用')`,
        {
          id: member.id,
          name: member.name,
          team: member.team,
          shiftType: member.shiftType,
          role: member.role,
        },
      );

      for (const [index, skill] of member.skills.entries()) {
        await connection.execute(
          `INSERT INTO TEAM_MEMBER_SKILL (ID, MEMBER_ID, SKILL_NAME)
           VALUES (:id, :memberId, :skillName)`,
          {
            id: `${member.id}-skill-${index + 1}`,
            memberId: member.id,
            skillName: skill,
          },
        );
      }
    }

    for (const shiftType of shiftTypes) {
      await connection.execute(
        `INSERT INTO SHIFT_TYPE (ID, SHIFT_CATEGORY, SCHEDULE_RULE, SHIFT_NAME, START_TIME, END_TIME)
         VALUES (:id, :shiftCategory, :scheduleRule, :shiftName, :startTime, :endTime)`,
        shiftType,
      );
    }

    for (const attendance of attendanceRecords) {
      const member = teamMembers.find((item) => item.name === attendance.personName);
      await connection.execute(
        `INSERT INTO ATTENDANCE_RECORD (ID, MEMBER_ID, PERSON_NAME, TEAM, START_DATE, END_DATE, STATUS)
         VALUES (:id, :memberId, :personName, :team, TO_DATE(:startDate, 'YYYY-MM-DD'), TO_DATE(:endDate, 'YYYY-MM-DD'), :status)`,
        {
          ...attendance,
          memberId: member?.id ?? null,
        },
      );
    }

    for (const record of teamScheduleRecords) {
      await connection.execute(
        `INSERT INTO TEAM_SCHEDULE_RECORD (ID, TEAM, TYPE, CURRENT_SHIFT, CURRENT_SHIFT_DATE, NEXT_SHIFT, NEXT_SHIFT_DATE)
         VALUES (:id, :team, :type, :currentShift, TO_DATE(:currentShiftDate, 'YYYY-MM-DD'), :nextShift, TO_DATE(:nextShiftDate, 'YYYY-MM-DD'))`,
        record,
      );
    }

    await connection.commit();
    console.log('Seed completed: demo scheduler data inserted.');
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
