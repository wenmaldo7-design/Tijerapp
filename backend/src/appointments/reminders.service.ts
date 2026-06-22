import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  // Ventana de recordatorio configurable (default 24h). Ej: REMINDER_WINDOW_HOURS=24
  private readonly windowHours: number;

  constructor(
    @InjectRepository(Appointment)
    private readonly apptRepo: Repository<Appointment>,
    private readonly mailService: MailService,
    config: ConfigService,
  ) {
    this.windowHours = config.get<number>('REMINDER_WINDOW_HOURS') ?? 24;
  }

  // Corre cada hora en el minuto 0
  @Cron(CronExpression.EVERY_HOUR)
  async sendPendingReminders(): Promise<void> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + this.windowHours * 60 * 60_000);

    const appointments = await this.apptRepo
      .createQueryBuilder('a')
      .where('a.status = :status', { status: AppointmentStatus.CONFIRMED })
      .andWhere('a.reminderSent = :sent', { sent: false })
      .andWhere('a.startTime > :now', { now })
      .andWhere('a.startTime <= :windowEnd', { windowEnd })
      .leftJoinAndSelect('a.client', 'client')
      .leftJoinAndSelect('a.staff', 'staff')
      .leftJoinAndSelect('staff.user', 'staffUser')
      .leftJoinAndSelect('a.service', 'service')
      .getMany();

    if (appointments.length === 0) return;

    this.logger.log(`Enviando ${appointments.length} recordatorio(s) de turno`);

    for (const appt of appointments) {
      // Enviar primero; marcar solo si el envío fue exitoso.
      // Un fallo de SMTP deja reminderSent=false → reintento en la próxima ejecución del cron.
      const sent = await this.mailService.sendReminder({
        appointmentId: appt.id,
        clientName: appt.client.name,
        clientEmail: appt.client.email,
        staffName: appt.staff.user.name,
        serviceName: appt.service.name,
        startTime: appt.startTime,
      });

      if (sent) {
        await this.apptRepo.update(appt.id, { reminderSent: true });
      }
    }
  }
}
