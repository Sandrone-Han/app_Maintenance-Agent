import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ShiftTypeController } from './shift-type.controller';
import { ShiftTypeService } from './shift-type.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ShiftTypeController],
  providers: [ShiftTypeService],
})
export class ShiftTypeModule {}
