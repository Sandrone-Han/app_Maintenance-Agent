import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

type TeamScheduleRecordRow = {
  ID: string;
  TEAM: string;
  TYPE: string;
  CURRENT_SHIFT: string;
  CURRENT_SHIFT_DATE: Date;
  NEXT_SHIFT: string;
  NEXT_SHIFT_DATE: Date;
};

@Injectable()
// 班组轮换记录服务：维护 A1/A2/A3 当前班次和下一班次状态。
export class TeamScheduleRecordService {
  constructor(private readonly databaseService: DatabaseService) {}

  // 查询当前班组轮换状态，供排班配置和记录页展示。
  async findAll() {
    const rows = await this.databaseService.query<TeamScheduleRecordRow>(`
      SELECT ID, TEAM, TYPE, CURRENT_SHIFT, CURRENT_SHIFT_DATE, NEXT_SHIFT, NEXT_SHIFT_DATE
      FROM TEAM_SCHEDULE_RECORD
      ORDER BY TEAM
    `);

    return rows.map((row) => ({
      id: row.ID,
      team: row.TEAM,
      type: row.TYPE,
      currentShift: row.CURRENT_SHIFT,
      currentShiftDate: this.formatDate(row.CURRENT_SHIFT_DATE),
      nextShift: row.NEXT_SHIFT,
      nextShiftDate: this.formatDate(row.NEXT_SHIFT_DATE),
    }));
  }

  // 重置默认轮换基准，用 MERGE 保证有记录则更新、无记录则插入。
  async resetDefault(baseDate?: string) {
    const date = baseDate && /^\d{4}-\d{2}-\d{2}$/.test(baseDate)
      ? baseDate
      : this.formatDate(new Date());
    const nextDate = this.formatDate(this.addDays(new Date(`${date}T00:00:00`), 1));
    const records = [
      { team: 'A1', currentShift: '早班', nextShift: '早班' },
      { team: 'A2', currentShift: '晚班', nextShift: '晚班' },
      { team: 'A3', currentShift: '休息', nextShift: '休息' },
    ];

    await this.databaseService.transaction(async (connection) => {
      for (const record of records) {
        await connection.execute(
          `MERGE INTO TEAM_SCHEDULE_RECORD target
           USING (SELECT :team AS TEAM FROM DUAL) source
           ON (target.TEAM = source.TEAM)
           WHEN MATCHED THEN UPDATE SET
             TYPE = '早晚班',
             CURRENT_SHIFT = :currentShift,
             CURRENT_SHIFT_DATE = TO_DATE(:currentShiftDate, 'YYYY-MM-DD'),
             NEXT_SHIFT = :nextShift,
             NEXT_SHIFT_DATE = TO_DATE(:nextShiftDate, 'YYYY-MM-DD'),
             UPDATED_AT = CURRENT_TIMESTAMP
           WHEN NOT MATCHED THEN INSERT
             (ID, TEAM, TYPE, CURRENT_SHIFT, CURRENT_SHIFT_DATE, NEXT_SHIFT, NEXT_SHIFT_DATE)
           VALUES
             (:id, :team, '早晚班', :currentShift, TO_DATE(:currentShiftDate, 'YYYY-MM-DD'), :nextShift, TO_DATE(:nextShiftDate, 'YYYY-MM-DD'))`,
          {
            id: randomUUID(),
            team: record.team,
            currentShift: record.currentShift,
            currentShiftDate: date,
            nextShift: record.nextShift,
            nextShiftDate: nextDate,
          },
        );
      }
    });

    return {
      baseDate: date,
      nextDate,
      records,
    };
  }

  // Oracle Date 转 yyyy-MM-dd，统一前端展示和接口入参格式。
  private formatDate(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  // 计算下一班次日期。
  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
