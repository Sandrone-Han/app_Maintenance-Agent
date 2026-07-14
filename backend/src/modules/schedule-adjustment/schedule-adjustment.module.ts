import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ScheduleAdjustmentController } from './schedule-adjustment.controller';
import { ScheduleAdjustmentService } from './schedule-adjustment.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ScheduleAdjustmentController],
  providers: [ScheduleAdjustmentService],
})
export class ScheduleAdjustmentModule {}
