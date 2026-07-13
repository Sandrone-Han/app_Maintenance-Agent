import { Body, Controller, Post } from '@nestjs/common';
import { EmployeeAgentService } from './employee-agent.service';

@Controller('employee-agent')
export class EmployeeAgentController {
  constructor(private readonly employeeAgentService: EmployeeAgentService) {}

  @Post('query')
  query(@Body() body: unknown) {
    return this.employeeAgentService.query(body);
  }
}
