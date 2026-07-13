import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

type ShiftTypeRow = {
  ID: string;
  SHIFT_CATEGORY: string;
  SCHEDULE_RULE: string;
  SHIFT_NAME: string;
  START_TIME: string;
  END_TIME: string;
};

type ShiftTypePayload = {
  shiftCategory?: string;
  scheduleRule?: string;
  shiftName?: string;
  startTime?: string;
  endTime?: string;
};

@Injectable()
export class ShiftTypeService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const rows = await this.databaseService.query<ShiftTypeRow>(`
      SELECT ID, SHIFT_CATEGORY, SCHEDULE_RULE, SHIFT_NAME, START_TIME, END_TIME
      FROM SHIFT_TYPE
      ORDER BY SHIFT_CATEGORY, SHIFT_NAME, ID
    `);

    return rows.map((row) => ({
      id: row.ID,
      shiftCategory: row.SHIFT_CATEGORY,
      scheduleRule: row.SCHEDULE_RULE,
      shiftName: row.SHIFT_NAME,
      startTime: row.START_TIME,
      endTime: row.END_TIME,
    }));
  }

  async create(rawPayload: unknown) {
    const payload = this.parsePayload(rawPayload);
    const id = randomUUID();

    await this.databaseService.execute(
      `INSERT INTO SHIFT_TYPE (ID, SHIFT_CATEGORY, SCHEDULE_RULE, SHIFT_NAME, START_TIME, END_TIME)
       VALUES (:id, :shiftCategory, :scheduleRule, :shiftName, :startTime, :endTime)`,
      { id, ...payload },
    );

    return { id };
  }

  async update(id: string, rawPayload: unknown) {
    const payload = this.parsePayload(rawPayload);
    await this.ensureExists(id);

    await this.databaseService.execute(
      `UPDATE SHIFT_TYPE
       SET SHIFT_CATEGORY = :shiftCategory,
           SCHEDULE_RULE = :scheduleRule,
           SHIFT_NAME = :shiftName,
           START_TIME = :startTime,
           END_TIME = :endTime,
           UPDATED_AT = CURRENT_TIMESTAMP
       WHERE ID = :id`,
      { id, ...payload },
    );

    return { id };
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.databaseService.execute('DELETE FROM SHIFT_TYPE WHERE ID = :id', { id });
    return { id };
  }

  private parsePayload(rawPayload: unknown): ShiftTypePayload {
    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new BadRequestException('请求体不能为空');
    }

    const payload = rawPayload as ShiftTypePayload;
    const requiredFields: Array<keyof ShiftTypePayload> = [
      'shiftCategory',
      'scheduleRule',
      'shiftName',
      'startTime',
      'endTime',
    ];

    for (const field of requiredFields) {
      if (!payload[field] || typeof payload[field] !== 'string') {
        throw new BadRequestException(`${field} 不能为空`);
      }
    }

    return payload;
  }

  private async ensureExists(id: string) {
    const rows = await this.databaseService.query<{ CNT: number }>(
      'SELECT COUNT(*) AS CNT FROM SHIFT_TYPE WHERE ID = :id',
      { id },
    );

    if (Number(rows[0]?.CNT ?? 0) === 0) {
      throw new NotFoundException('班次不存在');
    }
  }
}
