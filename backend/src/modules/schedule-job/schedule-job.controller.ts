import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ScheduleJobService } from './schedule-job.service';

@Controller('schedule-jobs')
export class ScheduleJobController {
  constructor(private readonly scheduleJobService: ScheduleJobService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.scheduleJobService.create(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scheduleJobService.findOne(id);
  }

  @Get(':id/logs')
  findLogs(@Param('id') id: string) {
    return this.scheduleJobService.findLogs(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.scheduleJobService.remove(id);
  }
}
