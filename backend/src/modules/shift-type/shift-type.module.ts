import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ShiftTypeController } from './shift-type.controller';
import { ShiftTypeService } from './shift-type.service';

// 班次模块：注册班次基础配置接口和服务。
@Module({
  imports: [DatabaseModule],
  controllers: [ShiftTypeController],
  providers: [ShiftTypeService],
})
export class ShiftTypeModule {}
