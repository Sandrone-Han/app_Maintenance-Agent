import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Controller('db-check')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  async check() {
    return this.databaseService.checkConnection();
  }
}
