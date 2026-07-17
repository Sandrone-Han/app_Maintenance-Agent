import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

// 出勤模块：注册出勤记录接口和服务，并复用数据库模块。
@Module({
  imports: [DatabaseModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
