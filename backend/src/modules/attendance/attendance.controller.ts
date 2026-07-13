import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

@Controller('attendance-records')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  findAll() {
    return this.attendanceService.findAll();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.attendanceService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.attendanceService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attendanceService.remove(id);
  }
}
