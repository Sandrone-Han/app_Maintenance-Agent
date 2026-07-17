import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TeamMemberController } from './team-member.controller';
import { TeamMemberService } from './team-member.service';

// 班组人员模块：注册人员 CRUD 和 Excel 导入能力。
@Module({
  imports: [DatabaseModule],
  controllers: [TeamMemberController],
  providers: [TeamMemberService],
})
export class TeamMemberModule {}
