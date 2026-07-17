import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ShiftTypeService } from './shift-type.service';

// 班次类型接口：维护早班、晚班、长白班等基础配置。
@Controller('shift-types')
export class ShiftTypeController {
  constructor(private readonly shiftTypeService: ShiftTypeService) {}

  // 查询全部班次配置。
  @Get()
  findAll() {
    return this.shiftTypeService.findAll();
  }

  // 新增班次配置。
  @Post()
  create(@Body() body: unknown) {
    return this.shiftTypeService.create(body);
  }

  // 更新指定班次配置。
  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.shiftTypeService.update(id, body);
  }

  // 删除指定班次配置。
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.shiftTypeService.remove(id);
  }
}
