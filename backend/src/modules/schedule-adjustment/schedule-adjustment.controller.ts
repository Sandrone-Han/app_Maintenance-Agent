import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ScheduleAdjustmentService } from './schedule-adjustment.service';

@Controller('schedule-adjustments')
export class ScheduleAdjustmentController {
  constructor(private readonly scheduleAdjustmentService: ScheduleAdjustmentService) {}

  @Get()
  findAll(@Query() query: Record<string, string | undefined>) {
    return this.scheduleAdjustmentService.findAll(query);
  }

  @Get('recommendations')
  recommendations(@Query('resultId') resultId: string) {
    return this.scheduleAdjustmentService.getRecommendations(resultId);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.scheduleAdjustmentService.create(body);
  }

  @Put(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.scheduleAdjustmentService.cancel(id);
  }
}
