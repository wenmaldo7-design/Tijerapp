import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface AppointmentMailContext {
  appointmentId: number;
  clientName: string;
  clientEmail: string;
  staffName: string;
  serviceName: string;
  startTime: Date;
}

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(config: ConfigService) {
    this.from = config.get<string>('MAIL_FROM') ?? 'Tijerapp <noreply@tijerapp.com>';
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('MAIL_HOST'),
      port: config.get<number>('MAIL_PORT') ?? 587,
      // Puerto 465 → SSL directo; cualquier otro → STARTTLS
      secure: config.get<number>('MAIL_PORT') === 465,
      auth: {
        user: config.get<string>('MAIL_USER'),
        pass: config.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendConfirmation(ctx: AppointmentMailContext): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: ctx.clientEmail,
        subject: `Turno reservado — ${ctx.serviceName}`,
        html: this.confirmationHtml(ctx),
      });
      this.logger.log(`Confirmación enviada a ${ctx.clientEmail} (turno #${ctx.appointmentId})`);
    } catch (err) {
      // El email no es crítico — se loguea pero no rompe el flujo
      this.logger.error(
        `Error enviando confirmación para turno #${ctx.appointmentId}: ${(err as Error).message}`,
      );
    }
  }

  // Devuelve true si el envío fue exitoso; false si falló (ya logueado).
  // El caller decide si marca reminderSent según el resultado.
  async sendReminder(ctx: AppointmentMailContext): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: ctx.clientEmail,
        subject: `Recordatorio: tu turno mañana — ${ctx.serviceName}`,
        html: this.reminderHtml(ctx),
      });
      this.logger.log(`Recordatorio enviado a ${ctx.clientEmail} (turno #${ctx.appointmentId})`);
      return true;
    } catch (err) {
      this.logger.error(
        `Error enviando recordatorio para turno #${ctx.appointmentId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private confirmationHtml(ctx: AppointmentMailContext): string {
    return `
      <h2>¡Tu turno está reservado!</h2>
      <p>Hola <strong>${ctx.clientName}</strong>,</p>
      <p>Tu turno para <strong>${ctx.serviceName}</strong>
         con <strong>${ctx.staffName}</strong>
         está programado para el <strong>${this.formatDatetime(ctx.startTime)}</strong>.</p>
      <p>Si necesitás cancelar, por favor avisanos con anticipación.</p>
      <p>¡Hasta pronto!</p>
    `;
  }

  private reminderHtml(ctx: AppointmentMailContext): string {
    return `
      <h2>Recordatorio de turno</h2>
      <p>Hola <strong>${ctx.clientName}</strong>,</p>
      <p>Te recordamos que mañana tenés turno para <strong>${ctx.serviceName}</strong>
         con <strong>${ctx.staffName}</strong>
         a las <strong>${this.formatDatetime(ctx.startTime)}</strong>.</p>
      <p>¡Te esperamos!</p>
    `;
  }

  private formatDatetime(d: Date): string {
    return d.toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Atlantic/Canary',
    });
  }
}
