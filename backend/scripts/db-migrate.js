const { getConnection, executeMany } = require('./db-common');

const tables = [
  {
    name: 'TEAM_MEMBER',
    statements: [`
  CREATE TABLE TEAM_MEMBER (
    ID VARCHAR2(36) PRIMARY KEY,
    NAME NVARCHAR2(50) NOT NULL,
    TEAM VARCHAR2(10) NOT NULL,
    SHIFT_TYPE NVARCHAR2(20) NOT NULL,
    ROLE NVARCHAR2(20) NOT NULL,
    STATUS NVARCHAR2(20) DEFAULT '启用' NOT NULL,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )
  `],
  },
  {
    name: 'TEAM_MEMBER_SKILL',
    statements: [`
  CREATE TABLE TEAM_MEMBER_SKILL (
    ID VARCHAR2(36) PRIMARY KEY,
    MEMBER_ID VARCHAR2(36) NOT NULL,
    SKILL_NAME NVARCHAR2(50) NOT NULL,
    CONSTRAINT FK_TEAM_MEMBER_SKILL_MEMBER
      FOREIGN KEY (MEMBER_ID) REFERENCES TEAM_MEMBER(ID)
      ON DELETE CASCADE
  )
  `],
  },
  {
    name: 'SHIFT_TYPE',
    statements: [`
  CREATE TABLE SHIFT_TYPE (
    ID VARCHAR2(36) PRIMARY KEY,
    SHIFT_CATEGORY NVARCHAR2(20) NOT NULL,
    SCHEDULE_RULE NVARCHAR2(50) NOT NULL,
    SHIFT_NAME NVARCHAR2(20) NOT NULL,
    START_TIME VARCHAR2(5) NOT NULL,
    END_TIME VARCHAR2(5) NOT NULL,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )
  `],
  },
  {
    name: 'ATTENDANCE_RECORD',
    statements: [`
  CREATE TABLE ATTENDANCE_RECORD (
    ID VARCHAR2(36) PRIMARY KEY,
    MEMBER_ID VARCHAR2(36),
    PERSON_NAME NVARCHAR2(50) NOT NULL,
    TEAM VARCHAR2(10) NOT NULL,
    START_DATE DATE NOT NULL,
    END_DATE DATE NOT NULL,
    STATUS NVARCHAR2(20) NOT NULL,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT FK_ATTENDANCE_MEMBER
      FOREIGN KEY (MEMBER_ID) REFERENCES TEAM_MEMBER(ID)
      ON DELETE SET NULL
  )
  `],
  },
  {
    name: 'TEAM_SCHEDULE_RECORD',
    statements: [`
  CREATE TABLE TEAM_SCHEDULE_RECORD (
    ID VARCHAR2(36) PRIMARY KEY,
    TEAM VARCHAR2(10) NOT NULL,
    TYPE NVARCHAR2(20) NOT NULL,
    CURRENT_SHIFT NVARCHAR2(20) NOT NULL,
    CURRENT_SHIFT_DATE DATE NOT NULL,
    NEXT_SHIFT NVARCHAR2(20) NOT NULL,
    NEXT_SHIFT_DATE DATE NOT NULL,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )
  `],
  },
  {
    name: 'SCHEDULE_JOB',
    statements: [`
  CREATE TABLE SCHEDULE_JOB (
    ID VARCHAR2(36) PRIMARY KEY,
    WEEKEND_MACHINE_COUNT NUMBER(10) NOT NULL,
    START_DATE DATE NOT NULL,
    END_DATE DATE NOT NULL,
    STATUS VARCHAR2(30) NOT NULL,
    ERROR_MESSAGE NVARCHAR2(1000),
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FINISHED_AT TIMESTAMP
  )
  `],
  },
  {
    name: 'SCHEDULE_SPECIAL_REQUEST',
    statements: [`
  CREATE TABLE SCHEDULE_SPECIAL_REQUEST (
    ID VARCHAR2(36) PRIMARY KEY,
    JOB_ID VARCHAR2(36) NOT NULL,
    PERSON_NAME NVARCHAR2(50) NOT NULL,
    REQUEST_DATE DATE NOT NULL,
    SHIFT_NAME NVARCHAR2(20) NOT NULL,
    CONSTRAINT FK_SPECIAL_REQUEST_JOB
      FOREIGN KEY (JOB_ID) REFERENCES SCHEDULE_JOB(ID)
      ON DELETE CASCADE
  )
  `],
  },
  {
    name: 'SCHEDULE_JOB_LOG',
    statements: [`
  CREATE TABLE SCHEDULE_JOB_LOG (
    ID VARCHAR2(36) PRIMARY KEY,
    JOB_ID VARCHAR2(36) NOT NULL,
    LEVEL_NAME VARCHAR2(20) NOT NULL,
    MESSAGE NVARCHAR2(1000) NOT NULL,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT FK_SCHEDULE_JOB_LOG_JOB
      FOREIGN KEY (JOB_ID) REFERENCES SCHEDULE_JOB(ID)
      ON DELETE CASCADE
  )
  `],
  },
  {
    name: 'SCHEDULE_RESULT',
    statements: [`
  CREATE TABLE SCHEDULE_RESULT (
    ID VARCHAR2(36) PRIMARY KEY,
    JOB_ID VARCHAR2(36) NOT NULL,
    WORK_DATE DATE NOT NULL,
    WEEKDAY_NAME NVARCHAR2(20),
    SHIFT_NAME NVARCHAR2(20) NOT NULL,
    TEAM VARCHAR2(10) NOT NULL,
    MEMBER_ID VARCHAR2(36),
    PERSON_NAME NVARCHAR2(50) NOT NULL,
    ROLE_NAME NVARCHAR2(20) NOT NULL,
    SKILLS_TEXT NVARCHAR2(200),
    STATUS NVARCHAR2(20) NOT NULL,
    IS_BORROWED NVARCHAR2(10) DEFAULT '否',
    ORIGINAL_TEAM VARCHAR2(10),
    ACTUAL_TEAM VARCHAR2(10),
    BORROW_REASON NVARCHAR2(100),
    VALIDATION_RESULT NVARCHAR2(20) DEFAULT '通过',
    EXCEPTION_REASON NVARCHAR2(1000),
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT FK_SCHEDULE_RESULT_JOB
      FOREIGN KEY (JOB_ID) REFERENCES SCHEDULE_JOB(ID)
      ON DELETE CASCADE
  )
  `],
  },
];

const indexes = [
  'CREATE INDEX IDX_TEAM_MEMBER_TEAM ON TEAM_MEMBER(TEAM)',
  'CREATE INDEX IDX_TEAM_MEMBER_SKILL_MEMBER ON TEAM_MEMBER_SKILL(MEMBER_ID)',
  'CREATE INDEX IDX_ATTENDANCE_DATES ON ATTENDANCE_RECORD(START_DATE, END_DATE)',
  'CREATE INDEX IDX_TEAM_SCHEDULE_TEAM ON TEAM_SCHEDULE_RECORD(TEAM)',
  'CREATE INDEX IDX_SCHEDULE_JOB_STATUS ON SCHEDULE_JOB(STATUS)',
  'CREATE INDEX IDX_SCHEDULE_RESULT_JOB ON SCHEDULE_RESULT(JOB_ID)',
  'CREATE INDEX IDX_SCHEDULE_RESULT_FILTER ON SCHEDULE_RESULT(WORK_DATE, TEAM, PERSON_NAME)',
];

async function tableExists(connection, tableName) {
  const result = await connection.execute(
    `SELECT COUNT(*) AS CNT FROM USER_TABLES WHERE TABLE_NAME = :tableName`,
    { tableName },
    { outFormat: 4002 },
  );

  return Number(result.rows?.[0]?.CNT ?? 0) > 0;
}

async function columnExists(connection, tableName, columnName) {
  const result = await connection.execute(
    `SELECT COUNT(*) AS CNT
     FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = :tableName AND COLUMN_NAME = :columnName`,
    { tableName, columnName },
    { outFormat: 4002 },
  );

  return Number(result.rows?.[0]?.CNT ?? 0) > 0;
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
  if (await columnExists(connection, tableName, columnName)) {
    console.log(`Column exists: ${tableName}.${columnName}`);
    return;
  }

  await connection.execute(`ALTER TABLE ${tableName} ADD (${definition})`);
  console.log(`Column added: ${tableName}.${columnName}`);
}

async function modifyColumn(connection, tableName, definition) {
  await connection.execute(`ALTER TABLE ${tableName} MODIFY (${definition})`);
  console.log(`Column modified: ${tableName}.${definition}`);
}

async function main() {
  const connection = await getConnection();

  try {
    for (const table of tables) {
      if (await tableExists(connection, table.name)) {
        console.log(`Table exists: ${table.name}`);
        continue;
      }

      await executeMany(connection, table.statements);
      console.log(`Table created: ${table.name}`);
    }

    for (const indexStatement of indexes) {
      try {
        await connection.execute(indexStatement);
      } catch (error) {
        if (!String(error).includes('ORA-00955')) {
          throw error;
        }
      }
    }

    if (await tableExists(connection, 'SCHEDULE_RESULT')) {
      await addColumnIfMissing(connection, 'SCHEDULE_RESULT', 'WEEKDAY_NAME', 'WEEKDAY_NAME NVARCHAR2(20)');
      await addColumnIfMissing(connection, 'SCHEDULE_RESULT', 'IS_BORROWED', "IS_BORROWED NVARCHAR2(10) DEFAULT '否'");
      await addColumnIfMissing(connection, 'SCHEDULE_RESULT', 'ORIGINAL_TEAM', 'ORIGINAL_TEAM VARCHAR2(10)');
      await addColumnIfMissing(connection, 'SCHEDULE_RESULT', 'ACTUAL_TEAM', 'ACTUAL_TEAM VARCHAR2(10)');
      await addColumnIfMissing(connection, 'SCHEDULE_RESULT', 'BORROW_REASON', 'BORROW_REASON NVARCHAR2(100)');
      await addColumnIfMissing(connection, 'SCHEDULE_RESULT', 'VALIDATION_RESULT', "VALIDATION_RESULT NVARCHAR2(20) DEFAULT '通过'");
      await addColumnIfMissing(connection, 'SCHEDULE_RESULT', 'EXCEPTION_REASON', 'EXCEPTION_REASON NVARCHAR2(1000)');
    }

    if (await tableExists(connection, 'SCHEDULE_JOB')) {
      await modifyColumn(connection, 'SCHEDULE_JOB', 'STATUS VARCHAR2(30)');
    }

    await connection.commit();
    console.log('Migration completed.');
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
