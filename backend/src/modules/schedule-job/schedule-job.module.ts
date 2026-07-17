import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ScheduleEngineService } from './schedule-engine.service';
import { ScheduleJobController } from './schedule-job.controller';
import { ScheduleJobService } from './schedule-job.service';

// 排班任务模块：注册任务接口、任务编排服务和确定性排班引擎。
@Module({
  imports: [DatabaseModule],
  controllers: [ScheduleJobController],
  providers: [ScheduleJobService, ScheduleEngineService],
})
export class ScheduleJobModule {}
