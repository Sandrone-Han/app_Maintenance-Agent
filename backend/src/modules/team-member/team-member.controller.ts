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

@Controller('team-members')
export class TeamMemberController {
  constructor(private readonly teamMemberService: TeamMemberService) {}

  @Get()
  findAll() {
    return this.teamMemberService.findAll();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.teamMemberService.create(body);
  }

  @Post('import-excel')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(@UploadedFile() file: UploadedExcelFile | undefined) {
    return this.teamMemberService.importExcel(file);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.teamMemberService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.teamMemberService.remove(id);
  }
}
