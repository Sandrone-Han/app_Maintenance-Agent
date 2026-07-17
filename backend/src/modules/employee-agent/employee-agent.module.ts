import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EmployeeAgentController } from './employee-agent.controller';
import { EmployeeAgentService } from './employee-agent.service';

// 员工查询模块：注册员工智能查询接口和服务。
@Module({
  imports: [DatabaseModule],
  controllers: [EmployeeAgentController],
  providers: [EmployeeAgentService],
})
export class EmployeeAgentModule {}
