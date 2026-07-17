import { Controller, Get } from '@nestjs/common';

// 健康检查接口：用于服务存活探测。
@Controller('health')
export class HealthController {
  // 返回后端服务基础状态和当前时间。
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'maintenance-scheduler-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
