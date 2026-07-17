import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

// 出勤记录接口：提供人员请假/出勤记录的增删改查。
@Controller('attendance-records')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // 查询全部出勤记录，前端人员信息页使用。
  @Get()
  findAll() {
    return this.attendanceService.findAll();
  }

  // 新增出勤/请假记录。
  @Post()
  create(@Body() body: unknown) {
    return this.attendanceService.create(body);
  }

  // 更新指定出勤记录。
  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.attendanceService.update(id, body);
  }

  // 删除指定出勤记录。
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attendanceService.remove(id);
  }
}
