import { Body, Controller, Get, Header, Param, Put, Query } from '@nestjs/common';
import { ScheduleResultService } from './schedule-result.service';

@Controller('schedule-results')
export class ScheduleResultController {
  constructor(private readonly scheduleResultService: ScheduleResultService) {}

  @Get()
  findAll(@Query() query: Record<string, string | undefined>) {
    return this.scheduleResultService.findAll(query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="schedule-results.csv"')
  async exportCsv(@Query() query: Record<string, string | undefined>) {
    return `\uFEFF${await this.scheduleResultService.exportCsv(query)}`;
  }

  @Put(':id/acknowledge-exception')
  acknowledgeException(@Param('id') id: string) {
    return this.scheduleResultService.acknowledgeException(id);
  }

  @Put(':id')
  updateResult(@Param('id') id: string, @Body() body: unknown) {
    return this.scheduleResultService.updateResult(id, body);
  }
}
