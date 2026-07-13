import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as xlsx from 'xlsx';
import { DatabaseService } from '../database/database.service';

type TeamMemberRow = {
  ID: string;
  NAME: string;
  TEAM: string;
  SHIFT_TYPE: string;
  ROLE: string;
  STATUS: string;
  SKILLS: string | null;
};

type TeamMemberPayload = {
  name?: string;
  team?: string;
  shiftType?: string;
  role?: string;
  status?: string;
  skills?: string[];
};

type UploadedExcelFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

type ImportRow = {
  rowNumber: number;
  name: string;
  team: string;
  shiftType: string;
  role: string;
  skills: string[];
};

type DbConnectionLike = {
  execute: (sql: string, params?: Record<string, unknown>) => Promise<unknown>;
};

@Injectable()
export class TeamMemberService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const rows = await this.databaseService.query<TeamMemberRow>(`
      SELECT
        tm.ID,
        tm.NAME,
        tm.TEAM,
        tm.SHIFT_TYPE,
        tm.ROLE,
        tm.STATUS,
        LISTAGG(tms.SKILL_NAME, ',') WITHIN GROUP (ORDER BY tms.SKILL_NAME) AS SKILLS
      FROM TEAM_MEMBER tm
      LEFT JOIN TEAM_MEMBER_SKILL tms ON tms.MEMBER_ID = tm.ID
      GROUP BY tm.ID, tm.NAME, tm.TEAM, tm.SHIFT_TYPE, tm.ROLE, tm.STATUS
      ORDER BY tm.NAME, tm.TEAM, tm.ID
    `);

    return rows.map((row) => ({
      id: row.ID,
      name: row.NAME,
      team: row.TEAM,
      shiftType: row.SHIFT_TYPE,
      role: row.ROLE,
      status: row.STATUS,
      skills: row.SKILLS ? row.SKILLS.split(',') : [],
    }));
  }

  async create(rawPayload: unknown) {
    const payload = this.parsePayload(rawPayload);
    const id = randomUUID();

    await this.databaseService.transaction(async (connection) => {
      await connection.execute(
        `INSERT INTO TEAM_MEMBER (ID, NAME, TEAM, SHIFT_TYPE, ROLE, STATUS)
         VALUES (:id, :name, :team, :shiftType, :role, :status)`,
        {
          id,
          name: payload.name,
          team: payload.team,
          shiftType: payload.shiftType,
          role: payload.role,
          status: payload.status ?? '启用',
        },
      );

      await this.replaceSkills(connection, id, payload.skills ?? []);
    });

    return { id };
  }

  async importExcel(file: UploadedExcelFile | undefined) {
    if (!file) {
      throw new BadRequestException('请上传 Excel 文件');
    }

    const rows = this.parseExcel(file.buffer);
    let inserted = 0;
    let updated = 0;

    await this.databaseService.transaction(async (connection) => {
      for (const row of rows) {
        if (!row.name || !row.team || !row.shiftType || !row.role) {
          throw new BadRequestException(`第 ${row.rowNumber} 行数据不完整`);
        }

        const existingId = await this.findIdByName(row.name);
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
        await this.replaceSkills(connection, memberId, row.skills);
      }
    });

    return {
      fileName: file.originalname,
      total: rows.length,
      inserted,
      updated,
    };
  }

  async update(id: string, rawPayload: unknown) {
    const payload = this.parsePayload(rawPayload);

    await this.ensureExists(id);
    await this.databaseService.transaction(async (connection) => {
      await connection.execute(
        `UPDATE TEAM_MEMBER
         SET NAME = :name,
             TEAM = :team,
             SHIFT_TYPE = :shiftType,
             ROLE = :role,
             STATUS = :status,
             UPDATED_AT = CURRENT_TIMESTAMP
         WHERE ID = :id`,
        {
          id,
          name: payload.name,
          team: payload.team,
          shiftType: payload.shiftType,
          role: payload.role,
          status: payload.status ?? '启用',
        },
      );

      await connection.execute(
        'DELETE FROM TEAM_MEMBER_SKILL WHERE MEMBER_ID = :id',
        { id },
      );
      await this.replaceSkills(connection, id, payload.skills ?? []);
    });

    return { id };
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.databaseService.execute(
      'DELETE FROM TEAM_MEMBER WHERE ID = :id',
      { id },
    );

    return { id };
  }

  private async ensureExists(id: string) {
    const rows = await this.databaseService.query<{ CNT: number }>(
      'SELECT COUNT(*) AS CNT FROM TEAM_MEMBER WHERE ID = :id',
      { id },
    );

    if (Number(rows[0]?.CNT ?? 0) === 0) {
      throw new NotFoundException('人员不存在');
    }
  }

  private async findIdByName(name: string) {
    const rows = await this.databaseService.query<{ ID: string }>(
      'SELECT ID FROM TEAM_MEMBER WHERE NAME = :name FETCH FIRST 1 ROWS ONLY',
      { name },
    );

    return rows[0]?.ID ?? null;
  }

  private parsePayload(rawPayload: unknown): TeamMemberPayload {
    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new BadRequestException('请求体不能为空');
    }

    const payload = rawPayload as TeamMemberPayload;
    const requiredFields: Array<keyof TeamMemberPayload> = ['name', 'team', 'shiftType', 'role'];

    for (const field of requiredFields) {
      if (!payload[field] || typeof payload[field] !== 'string') {
        throw new BadRequestException(`${field} 不能为空`);
      }
    }

    if (payload.skills !== undefined && !Array.isArray(payload.skills)) {
      throw new BadRequestException('skills 必须是数组');
    }

    return payload;
  }

  private parseExcel(buffer: Buffer): ImportRow[] {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('Excel 文件没有工作表');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    const headers = (rows[0] ?? []).map((header) => String(header).trim());
    const requiredHeaders = ['姓名', '班组', '班次类型', '角色', '技能'];

    for (const header of requiredHeaders) {
      if (!headers.includes(header)) {
        throw new BadRequestException(`Excel 缺少必填列：${header}`);
      }
    }

    const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));

    return rows
      .slice(1)
      .map((row, index) => ({
        rowNumber: index + 2,
        name: String(row[headerIndex['姓名']] ?? '').trim(),
        team: String(row[headerIndex['班组']] ?? '').trim(),
        shiftType: this.normalizeShiftType(row[headerIndex['班次类型']]),
        role: this.normalizeRole(row[headerIndex['角色']]),
        skills: this.parseSkills(row[headerIndex['技能']]),
      }))
      .filter((row) => row.name);
  }

  private normalizeShiftType(value: unknown) {
    const text = String(value ?? '').trim();
    if (text === '早班/晚班') return '早晚班';
    return text;
  }

  private normalizeRole(value: unknown) {
    const text = String(value ?? '').trim();
    if (text.includes('班长')) return '组长';
    return text || '组员';
  }

  private parseSkills(value: unknown) {
    return String(value ?? '')
      .split(/[，,、/]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private async replaceSkills(
    connection: DbConnectionLike,
    memberId: string,
    skills: string[],
  ) {
    for (const skill of skills) {
      if (!skill) continue;

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
}
