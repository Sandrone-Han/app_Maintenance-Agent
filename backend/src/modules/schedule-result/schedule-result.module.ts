import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ScheduleResultController } from './schedule-result.controller';
import { ScheduleResultService } from './schedule-result.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ScheduleResultController],
  providers: [ScheduleResultService],
})
export class ScheduleResultModule {}
