import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ScheduleSwapService } from './schedule-swap.service';

@Controller('schedule-swaps')
export class ScheduleSwapController {
  constructor(private readonly scheduleSwapService: ScheduleSwapService) {}

  @Get()
  findAll(@Query() query: Record<string, string | undefined>) {
    return this.scheduleSwapService.findAll(query);
  }

  @Get('recommendations')
  recommendations(@Query('resultId') resultId: string) {
    return this.scheduleSwapService.getRecommendations(resultId);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.scheduleSwapService.create(body);
  }

  @Put(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.scheduleSwapService.cancel(id);
  }
}
