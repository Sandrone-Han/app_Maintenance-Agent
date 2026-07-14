import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ScheduleSwapController } from './schedule-swap.controller';
import { ScheduleSwapService } from './schedule-swap.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ScheduleSwapController],
  providers: [ScheduleSwapService],
})
export class ScheduleSwapModule {}
