import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TeamScheduleRecordController } from './team-schedule-record.controller';
import { TeamScheduleRecordService } from './team-schedule-record.service';

// 班组轮换记录模块：注册轮换记录查询和默认重置能力。
@Module({
  imports: [DatabaseModule],
  controllers: [TeamScheduleRecordController],
  providers: [TeamScheduleRecordService],
})
export class TeamScheduleRecordModule {}
