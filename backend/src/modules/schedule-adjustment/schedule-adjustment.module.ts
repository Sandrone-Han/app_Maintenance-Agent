import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ScheduleAdjustmentController } from './schedule-adjustment.controller';
import { ScheduleAdjustmentService } from './schedule-adjustment.service';

// 请假替班模块：注册推荐、创建、查询和撤销临时调整能力。
@Module({
  imports: [DatabaseModule],
  controllers: [ScheduleAdjustmentController],
  providers: [ScheduleAdjustmentService],
})
export class ScheduleAdjustmentModule {}
