import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { DatabaseModule } from './modules/database/database.module';
import { TeamMemberModule } from './modules/team-member/team-member.module';
import { ShiftTypeModule } from './modules/shift-type/shift-type.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { TeamScheduleRecordModule } from './modules/team-schedule-record/team-schedule-record.module';
import { ScheduleJobModule } from './modules/schedule-job/schedule-job.module';
import { ScheduleResultModule } from './modules/schedule-result/schedule-result.module';
import { EmployeeAgentModule } from './modules/employee-agent/employee-agent.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
      isGlobal: true,
    }),
    HealthModule,
    DatabaseModule,
    TeamMemberModule,
    ShiftTypeModule,
    AttendanceModule,
    TeamScheduleRecordModule,
    ScheduleJobModule,
    ScheduleResultModule,
    EmployeeAgentModule,
  ],
})
export class AppModule {}
