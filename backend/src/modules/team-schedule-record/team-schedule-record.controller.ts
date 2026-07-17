import { Body, Controller, Get, Post } from '@nestjs/common';
import { TeamScheduleRecordService } from './team-schedule-record.service';

// 班组轮换记录接口：查询当前轮换状态，并支持恢复默认轮换。
@Controller('team-schedule-records')
export class TeamScheduleRecordController {
  constructor(private readonly teamScheduleRecordService: TeamScheduleRecordService) {}

  // 查询全部班组轮换记录。
  @Get()
  findAll() {
    return this.teamScheduleRecordService.findAll();
  }

  // 重置默认轮换基准日期。
  @Post('reset-default')
  resetDefault(@Body() body: { baseDate?: string }) {
    return this.teamScheduleRecordService.resetDefault(body?.baseDate);
  }
}
