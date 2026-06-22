import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffProfile } from './entities/staff-profile.entity';
import { WorkingHours } from './entities/working-hours.entity';
import { TimeOff } from './entities/time-off.entity';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StaffProfile, WorkingHours, TimeOff]),
    UsersModule,
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
