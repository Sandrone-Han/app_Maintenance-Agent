import { Body, Controller, Get, Post } from '@nestjs/common';
import { TeamScheduleRecordService } from './team-schedule-record.service';

@Controller('team-schedule-records')
export class TeamScheduleRecordController {
  constructor(private readonly teamScheduleRecordService: TeamScheduleRecordService) {}

  @Get()
  findAll() {
    return this.teamScheduleRecordService.findAll();
  }

  @Post('reset-default')
  resetDefault(@Body() body: { baseDate?: string }) {
    return this.teamScheduleRecordService.resetDefault(body?.baseDate);
  }
}
