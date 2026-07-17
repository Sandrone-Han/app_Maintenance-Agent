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
import { ScheduleAdjustmentModule } from './modules/schedule-adjustment/schedule-adjustment.module';
import { ScheduleSwapModule } from './modules/schedule-swap/schedule-swap.module';

// 后端根模块：集中注册配置、数据库和所有业务模块。
@Module({
  imports: [
    // 配置模块全局可用，优先读取本地环境文件。
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
      isGlobal: true,
    }),
    // 基础能力模块。
    HealthModule,
    DatabaseModule,
    // 设备维护排班相关业务模块。
    TeamMemberModule,
    ShiftTypeModule,
    AttendanceModule,
    TeamScheduleRecordModule,
    ScheduleJobModule,
    ScheduleResultModule,
    ScheduleAdjustmentModule,
    ScheduleSwapModule,
    EmployeeAgentModule,
  ],
})
export class AppModule {}
