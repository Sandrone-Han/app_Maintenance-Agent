import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ScheduleSwapService } from './schedule-swap.service';

// 换班接口：查询记录、推荐候选、创建换班和撤销换班。
@Controller('schedule-swaps')
export class ScheduleSwapController {
  constructor(private readonly scheduleSwapService: ScheduleSwapService) {}

  // 查询换班记录。
  @Get()
  findAll(@Query() query: Record<string, string | undefined>) {
    return this.scheduleSwapService.findAll(query);
  }

  // 根据排班结果获取可换班候选。
  @Get('recommendations')
  recommendations(@Query('resultId') resultId: string) {
    return this.scheduleSwapService.getRecommendations(resultId);
  }

  // 创建一条换班记录。
  @Post()
  create(@Body() body: unknown) {
    return this.scheduleSwapService.create(body);
  }

  // 撤销已生效的换班记录。
  @Put(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.scheduleSwapService.cancel(id);
  }
}
