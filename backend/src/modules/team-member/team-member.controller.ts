import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TeamMemberService } from './team-member.service';

type UploadedExcelFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

// 班组人员接口：提供人员 CRUD 和 Excel 批量导入。
@Controller('team-members')
export class TeamMemberController {
  constructor(private readonly teamMemberService: TeamMemberService) {}

  // 查询全部人员及其技能。
  @Get()
  findAll() {
    return this.teamMemberService.findAll();
  }

  // 新增人员基础信息和技能。
  @Post()
  create(@Body() body: unknown) {
    return this.teamMemberService.create(body);
  }

  // 上传 Excel 后交给服务层解析、插入或更新人员。
  @Post('import-excel')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(@UploadedFile() file: UploadedExcelFile | undefined) {
    return this.teamMemberService.importExcel(file);
  }

  // 更新指定人员及其技能。
  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.teamMemberService.update(id, body);
  }

  // 删除指定人员。
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.teamMemberService.remove(id);
  }
}
