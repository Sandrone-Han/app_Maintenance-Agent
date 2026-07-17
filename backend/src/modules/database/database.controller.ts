import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database.service';

// 数据库检查接口：用于快速确认后端能连通 Oracle。
@Controller('db-check')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  // 执行轻量查询并返回数据库连接状态。
  @Get()
  async check() {
    return this.databaseService.checkConnection();
  }
}
