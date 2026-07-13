import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

type AttendanceRow = {
  ID: string;
  PERSON_NAME: string;
  TEAM: string;
  START_DATE: Date;
  END_DATE: Date;
  STATUS: string;
  UPDATED_AT: Date;
};

type AttendancePayload = {
  personName?: string;
  team?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
};

@Injectable()
export class AttendanceService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const rows = await this.databaseService.query<AttendanceRow>(`
      SELECT ID, PERSON_NAME, TEAM, START_DATE, END_DATE, STATUS, UPDATED_AT
      FROM ATTENDANCE_RECORD
      ORDER BY PERSON_NAME, START_DATE DESC, ID
    `);

    return rows.map((row) => ({
      id: row.ID,
      personName: row.PERSON_NAME,
      team: row.TEAM,
      startDate: this.formatDate(row.START_DATE),
      endDate: this.formatDate(row.END_DATE),
      status: row.STATUS,
      updatedAt: row.UPDATED_AT.toISOString(),
    }));
  }

  async create(rawPayload: unknown) {
    const payload = this.parsePayload(rawPayload);
    const id = randomUUID();
    const memberId = await this.findMemberId(payload.personName);

    await this.databaseService.execute(
      `INSERT INTO ATTENDANCE_RECORD (ID, MEMBER_ID, PERSON_NAME, TEAM, START_DATE, END_DATE, STATUS)
       VALUES (:id, :memberId, :personName, :team, TO_DATE(:startDate, 'YYYY-MM-DD'), TO_DATE(:endDate, 'YYYY-MM-DD'), :status)`,
      { id, memberId, ...payload },
    );

    return { id };
  }

  async update(id: string, rawPayload: unknown) {
    const payload = this.parsePayload(rawPayload);
    const memberId = await this.findMemberId(payload.personName);
    await this.ensureExists(id);

    await this.databaseService.execute(
      `UPDATE ATTENDANCE_RECORD
       SET MEMBER_ID = :memberId,
           PERSON_NAME = :personName,
           TEAM = :team,
           START_DATE = TO_DATE(:startDate, 'YYYY-MM-DD'),
           END_DATE = TO_DATE(:endDate, 'YYYY-MM-DD'),
           STATUS = :status,
           UPDATED_AT = CURRENT_TIMESTAMP
       WHERE ID = :id`,
      { id, memberId, ...payload },
    );

    return { id };
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.databaseService.execute('DELETE FROM ATTENDANCE_RECORD WHERE ID = :id', { id });
    return { id };
  }

  private parsePayload(rawPayload: unknown): Required<AttendancePayload> {
    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new BadRequestException('请求体不能为空');
    }

    const payload = rawPayload as AttendancePayload;
    const requiredFields: Array<keyof AttendancePayload> = [
      'personName',
      'team',
      'startDate',
      'endDate',
      'status',
    ];

    for (const field of requiredFields) {
      if (!payload[field] || typeof payload[field] !== 'string') {
        throw new BadRequestException(`${field} 不能为空`);
      }
    }

    return payload as Required<AttendancePayload>;
  }

  private async findMemberId(personName: string) {
    const rows = await this.databaseService.query<{ ID: string }>(
      'SELECT ID FROM TEAM_MEMBER WHERE NAME = :personName FETCH FIRST 1 ROWS ONLY',
      { personName },
    );

    return rows[0]?.ID ?? null;
  }

  private async ensureExists(id: string) {
    const rows = await this.databaseService.query<{ CNT: number }>(
      'SELECT COUNT(*) AS CNT FROM ATTENDANCE_RECORD WHERE ID = :id',
      { id },
    );

    if (Number(rows[0]?.CNT ?? 0) === 0) {
      throw new NotFoundException('出勤记录不存在');
    }
  }

  private formatDate(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
