import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ShiftTypeService } from './shift-type.service';

@Controller('shift-types')
export class ShiftTypeController {
  constructor(private readonly shiftTypeService: ShiftTypeService) {}

  @Get()
  findAll() {
    return this.shiftTypeService.findAll();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.shiftTypeService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.shiftTypeService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.shiftTypeService.remove(id);
  }
}
