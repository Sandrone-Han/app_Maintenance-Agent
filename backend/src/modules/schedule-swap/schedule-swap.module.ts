import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ScheduleSwapController } from './schedule-swap.controller';
import { ScheduleSwapService } from './schedule-swap.service';

// 换班模块：注册换班推荐、创建、查询和撤销能力。
@Module({
  imports: [DatabaseModule],
  controllers: [ScheduleSwapController],
  providers: [ScheduleSwapService],
})
export class ScheduleSwapModule {}
