import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ScheduleJobService } from './schedule-job.service';

// 排班任务接口：创建排班任务、查询任务摘要、查看日志和删除任务。
@Controller('schedule-jobs')
export class ScheduleJobController {
  constructor(private readonly scheduleJobService: ScheduleJobService) {}

  // 创建并执行一次排班任务。
  @Post()
  create(@Body() body: unknown) {
    return this.scheduleJobService.create(body);
  }

  // 查询单个排班任务状态和结果数量。
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scheduleJobService.findOne(id);
  }

  // 查询排班任务执行日志。
  @Get(':id/logs')
  findLogs(@Param('id') id: string) {
    return this.scheduleJobService.findLogs(id);
  }

  // 删除排班任务。
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.scheduleJobService.remove(id);
  }
}
