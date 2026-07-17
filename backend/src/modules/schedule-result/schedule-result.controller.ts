import { Body, Controller, Get, Header, Param, Put, Query } from '@nestjs/common';
import { ScheduleResultService } from './schedule-result.service';

// 排班结果接口：查询、导出、异常确认和手工编辑。
@Controller('schedule-results')
export class ScheduleResultController {
  constructor(private readonly scheduleResultService: ScheduleResultService) {}

  // 按筛选条件查询排班结果。
  @Get()
  findAll(@Query() query: Record<string, string | undefined>) {
    return this.scheduleResultService.findAll(query);
  }

  // 导出当前筛选条件下的 CSV。
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="schedule-results.csv"')
  async exportCsv(@Query() query: Record<string, string | undefined>) {
    return `\uFEFF${await this.scheduleResultService.exportCsv(query)}`;
  }

  // 将异常标记为已确认。
  @Put(':id/acknowledge-exception')
  acknowledgeException(@Param('id') id: string) {
    return this.scheduleResultService.acknowledgeException(id);
  }

  // 手工编辑单条排班结果。
  @Put(':id')
  updateResult(@Param('id') id: string, @Body() body: unknown) {
    return this.scheduleResultService.updateResult(id, body);
  }
}
