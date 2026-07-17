import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ScheduleResultController } from './schedule-result.controller';
import { ScheduleResultService } from './schedule-result.service';

// 排班结果模块：提供结果查询、编辑、异常确认和 CSV 导出。
@Module({
  imports: [DatabaseModule],
  controllers: [ScheduleResultController],
  providers: [ScheduleResultService],
})
export class ScheduleResultModule {}
