import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { WorkingHours } from '../staff/entities/working-hours.entity';
import { TimeOff } from '../staff/entities/time-off.entity';
import { Service } from '../services/entities/service.entity';
import { StaffProfile } from '../staff/entities/staff-profile.entity';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, WorkingHours, TimeOff, Service, StaffProfile]),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, RemindersService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
