import { Body, Controller, Post } from '@nestjs/common';
import { EmployeeAgentService } from './employee-agent.service';

// 员工查询接口：接收自然语言问题并返回结构化查询结果。
@Controller('employee-agent')
export class EmployeeAgentController {
  constructor(private readonly employeeAgentService: EmployeeAgentService) {}

  // 查询员工档案、排班、借调、异常和出勤信息。
  @Post('query')
  query(@Body() body: unknown) {
    return this.employeeAgentService.query(body);
  }
}
