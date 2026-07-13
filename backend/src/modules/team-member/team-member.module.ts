import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TeamMemberController } from './team-member.controller';
import { TeamMemberService } from './team-member.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TeamMemberController],
  providers: [TeamMemberService],
})
export class TeamMemberModule {}
