import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// 健康检查模块：提供 /api/health 存活检查。
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
