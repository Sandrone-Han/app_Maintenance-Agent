import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TeamScheduleRecordController } from './team-schedule-record.controller';
import { TeamScheduleRecordService } from './team-schedule-record.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TeamScheduleRecordController],
  providers: [TeamScheduleRecordService],
})
export class TeamScheduleRecordModule {}
