import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EmployeeAgentController } from './employee-agent.controller';
import { EmployeeAgentService } from './employee-agent.service';

@Module({
  imports: [DatabaseModule],
  controllers: [EmployeeAgentController],
  providers: [EmployeeAgentService],
})
export class EmployeeAgentModule {}
