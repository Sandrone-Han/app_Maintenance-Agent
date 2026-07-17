import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ScheduleAdjustmentService } from './schedule-adjustment.service';

// 请假替班接口：查询记录、推荐候选、创建调整和撤销调整。
@Controller('schedule-adjustments')
export class ScheduleAdjustmentController {
  constructor(private readonly scheduleAdjustmentService: ScheduleAdjustmentService) {}

  // 查询请假替班记录。
  @Get()
  findAll(@Query() query: Record<string, string | undefined>) {
    return this.scheduleAdjustmentService.findAll(query);
  }

  // 根据排班结果获取可替班人员推荐。
  @Get('recommendations')
  recommendations(@Query('resultId') resultId: string) {
    return this.scheduleAdjustmentService.getRecommendations(resultId);
  }

  // 创建一条请假替班调整。
  @Post()
  create(@Body() body: unknown) {
    return this.scheduleAdjustmentService.create(body);
  }

  // 撤销已生效的请假替班调整。
  @Put(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.scheduleAdjustmentService.cancel(id);
  }
}
