import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ScheduleEngineService } from './schedule-engine.service';
import { ScheduleJobController } from './schedule-job.controller';
import { ScheduleJobService } from './schedule-job.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ScheduleJobController],
  providers: [ScheduleJobService, ScheduleEngineService],
})
export class ScheduleJobModule {}
