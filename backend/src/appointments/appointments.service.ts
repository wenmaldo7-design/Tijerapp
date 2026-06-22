import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { WorkingHours } from '../staff/entities/working-hours.entity';
import { TimeOff } from '../staff/entities/time-off.entity';
import { Service } from '../services/entities/service.entity';
import { StaffProfile } from '../staff/entities/staff-profile.entity';
import { UserRole } from '../users/user-role.enum';
import { GetSlotsQueryDto } from './dto/get-slots-query.dto';
import { AdminAppointmentsQueryDto } from './dto/admin-appointments-query.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { MailService } from '../mail/mail.service';

// Estrategia de zona horaria: todos los datetime se tratan como hora local de Canarias
// (sin conversión TZ). El cliente envía y recibe strings ISO sin offset ("2026-07-15T10:00:00").
// MySQL almacena DATETIME sin zona; el driver los devuelve como Date en hora local del servidor.
// En producción, el servidor debe correr con TZ=Atlantic/Canary.

export interface AvailableSlot {
  startTime: string; // ISO local, apto para usar directamente en CreateAppointmentDto
  endTime: string;
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(WorkingHours)
    private readonly workingHoursRepo: Repository<WorkingHours>,
    @InjectRepository(TimeOff)
    private readonly timeOffRepo: Repository<TimeOff>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(StaffProfile)
    private readonly staffProfileRepo: Repository<StaffProfile>,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  // ---------------------------------------------------------------------------
  // Consultas básicas
  // ---------------------------------------------------------------------------

  findAll(): Promise<Appointment[]> {
    return this.apptRepo.find({
      relations: { client: true, staff: true, service: true },
      order: { startTime: 'ASC' },
    });
  }

  async findAdminAppointments(query: AdminAppointmentsQueryDto): Promise<{
    data: Appointment[];
    total: number;
    page: number;
    totalPages: number;
    summary: Record<AppointmentStatus, number>;
  }> {
    const { from, to, status, staffProfileId, serviceId } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.apptRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.client', 'client')
      .leftJoinAndSelect('a.staff', 'staff')
      .leftJoinAndSelect('staff.user', 'staffUser')
      .leftJoinAndSelect('a.service', 'service')
      .orderBy('a.startTime', 'DESC');

    if (from) qb.andWhere('DATE(a.startTime) >= :from', { from });
    if (to) qb.andWhere('DATE(a.startTime) <= :to', { to });
    if (status) qb.andWhere('a.status = :status', { status });
    if (staffProfileId) qb.andWhere('a.staffProfileId = :staffProfileId', { staffProfileId });
    if (serviceId) qb.andWhere('a.serviceId = :serviceId', { serviceId });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Summary counts by status (unfiltered by status, but respecting date/staff/service filters)
    const summaryQb = this.apptRepo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(a.id)', 'count');

    if (from) summaryQb.andWhere('DATE(a.startTime) >= :from', { from });
    if (to) summaryQb.andWhere('DATE(a.startTime) <= :to', { to });
    if (staffProfileId) summaryQb.andWhere('a.staffProfileId = :staffProfileId', { staffProfileId });
    if (serviceId) summaryQb.andWhere('a.serviceId = :serviceId', { serviceId });

    const summaryRows = await summaryQb.groupBy('a.status').getRawMany<{ status: string; count: string }>();
    const summary = {
      [AppointmentStatus.PENDING]: 0,
      [AppointmentStatus.CONFIRMED]: 0,
      [AppointmentStatus.COMPLETED]: 0,
      [AppointmentStatus.CANCELLED]: 0,
    } as Record<AppointmentStatus, number>;
    for (const row of summaryRows) {
      summary[row.status as AppointmentStatus] = Number(row.count);
    }

    return { data, total, page, totalPages: Math.ceil(total / limit), summary };
  }

  async findAgenda(userId: number, date?: string): Promise<Appointment[]> {
    const staffProfile = await this.staffProfileRepo.findOneBy({ userId });
    if (!staffProfile) return [];

    const qb = this.apptRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.client', 'client')
      .leftJoinAndSelect('a.service', 'service')
      .where('a.staffProfileId = :staffProfileId', { staffProfileId: staffProfile.id })
      .orderBy('a.startTime', 'ASC');

    if (date) {
      qb.andWhere('DATE(a.startTime) = :date', { date });
    }

    return qb.getMany();
  }

  findByClient(clientId: number): Promise<Appointment[]> {
    return this.apptRepo.find({
      where: { clientId },
      relations: { staff: { user: true }, service: true },
      order: { startTime: 'ASC' },
    });
  }

  async findById(id: number): Promise<Appointment> {
    const appt = await this.apptRepo.findOne({
      where: { id },
      relations: { client: true, staff: true, service: true },
    });
    if (!appt) throw new NotFoundException(`Turno #${id} no encontrado`);
    return appt;
  }

  // ---------------------------------------------------------------------------
  // Motor de disponibilidad
  // ---------------------------------------------------------------------------

  async getAvailableSlots(
    query: GetSlotsQueryDto,
    slotIntervalMinutes = 15,
  ): Promise<AvailableSlot[]> {
    const { staffProfileId, serviceId, date } = query;

    // Día de la semana local — parseamos la fecha como local para que getDay() sea correcto
    const [year, month, day] = date.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();

    // 1. Todos los bloques de horario del peluquero para ese día (puede haber varios: ej 9-14 y 16-20)
    const workingHoursBlocks = await this.workingHoursRepo.find({
      where: { staffProfileId, dayOfWeek },
      order: { startTime: 'ASC' },
    });
    if (workingHoursBlocks.length === 0) return []; // no trabaja ese día

    // 2. Bloqueos de agenda — cada TimeOff bloquea el día completo
    const blockedCount = await this.timeOffRepo
      .createQueryBuilder('to')
      .where('to.staffProfileId = :staffProfileId', { staffProfileId })
      .andWhere('to.startDate <= :date', { date })
      .andWhere('to.endDate >= :date', { date })
      .getCount();

    if (blockedCount > 0) return [];

    // 3. Duración del servicio — solo servicios activos generan slots
    const service = await this.serviceRepo.findOneBy({ id: serviceId, isActive: true });
    if (!service) return []; // no existe o está dado de baja
    const { durationMinutes } = service;

    // 4. Turnos activos del día — usamos DATE() en SQL para evitar ambigüedad de TZ
    const dayAppointments = await this.apptRepo
      .createQueryBuilder('a')
      .where('a.staffProfileId = :staffProfileId', { staffProfileId })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
      })
      .andWhere('DATE(a.startTime) = :date', { date })
      .getMany();

    // 5. Generar slots candidatos y filtrar solapamientos
    const toMin = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    // La comparación en memoria usa minutos desde medianoche para evitar conversiones TZ
    const toMidnightMin = (d: Date) => d.getHours() * 60 + d.getMinutes();

    const pad = (n: number) => String(n).padStart(2, '0');
    const toISO = (totalMin: number) =>
      `${date}T${pad(Math.floor(totalMin / 60))}:${pad(totalMin % 60)}:00`;

    const slots: AvailableSlot[] = [];

    // Itera bloque por bloque — los slots de un bloque nunca caen en el hueco al siguiente
    for (const wh of workingHoursBlocks) {
      const workStartMin = toMin(wh.startTime);
      const workEndMin = toMin(wh.endTime);

      for (
        let t = workStartMin;
        t + durationMinutes <= workEndMin;
        t += slotIntervalMinutes
      ) {
        const slotEndMin = t + durationMinutes;

        const hasOverlap = dayAppointments.some((a) => {
          const aStart = toMidnightMin(new Date(a.startTime));
          const aEnd = toMidnightMin(new Date(a.endTime));
          return aStart < slotEndMin && aEnd > t;
        });

        if (!hasOverlap) {
          slots.push({ startTime: toISO(t), endTime: toISO(slotEndMin) });
        }
      }
    }

    return slots;
  }

  // ---------------------------------------------------------------------------
  // Crear turno
  // ---------------------------------------------------------------------------

  async createAppointment(
    clientId: number,
    dto: CreateAppointmentDto,
  ): Promise<Appointment> {
    const { staffProfileId, serviceId, startTime: startTimeStr, notes } = dto;

    // 1. Servicio activo (aquí sí es error, no []  — el cliente eligió uno concreto)
    const service = await this.serviceRepo.findOneBy({ id: serviceId, isActive: true });
    if (!service) {
      throw new NotFoundException(`Servicio #${serviceId} no encontrado o inactivo`);
    }

    // 2. Parsear fechas — ISO sin offset → hora local del servidor (Canarias en producción)
    const startTime = new Date(startTimeStr);
    if (startTime <= new Date()) {
      throw new BadRequestException('No se puede reservar un turno en el pasado');
    }
    const endTime = new Date(startTime.getTime() + service.durationMinutes * 60_000);

    // 4. El slot debe caer dentro de un bloque de WorkingHours
    const dayOfWeek = startTime.getDay();
    // Usar startMin + duration evita ambigüedad si endTime cruza medianoche
    const startMin = startTime.getHours() * 60 + startTime.getMinutes();
    const endMin = startMin + service.durationMinutes;

    const blocks = await this.workingHoursRepo.find({ where: { staffProfileId, dayOfWeek } });
    const fitsInBlock = blocks.some((wh) => {
      const [sh, sm] = wh.startTime.split(':').map(Number);
      const [eh, em] = wh.endTime.split(':').map(Number);
      return startMin >= sh * 60 + sm && endMin <= eh * 60 + em;
    });
    if (!fitsInBlock) {
      throw new BadRequestException('El horario solicitado está fuera del horario laboral del peluquero');
    }

    // 5. Día no bloqueado por TimeOff
    const date = startTimeStr.substring(0, 10); // YYYY-MM-DD
    const blockedCount = await this.timeOffRepo
      .createQueryBuilder('to')
      .where('to.staffProfileId = :staffProfileId', { staffProfileId })
      .andWhere('to.startDate <= :date', { date })
      .andWhere('to.endDate >= :date', { date })
      .getCount();
    if (blockedCount > 0) {
      throw new ConflictException('El peluquero no está disponible en esa fecha');
    }

    // 6. Transacción: lock pesimista sobre el peluquero → serializa reservas concurrentes
    //    del mismo staff. La segunda request espera hasta que la primera commitee;
    //    cuando sigue, findActiveOverlaps ya ve el turno nuevo y devuelve 409.
    const saved = await this.dataSource.transaction(async (manager) => {
      const lockedStaff = await manager.findOne(StaffProfile, {
        where: { id: staffProfileId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedStaff) {
        throw new NotFoundException(`Peluquero #${staffProfileId} no encontrado`);
      }

      const overlaps = await this.findActiveOverlaps(
        staffProfileId, startTime, endTime, undefined, manager,
      );
      if (overlaps.length > 0) {
        throw new ConflictException('El horario ya está ocupado por otro turno');
      }

      const appt = manager.create(Appointment, {
        clientId,
        staffProfileId,
        serviceId,
        startTime,
        endTime,
        notes,
        status: AppointmentStatus.PENDING,
      });
      return manager.save(appt);
    });

    // Confirmación por email — DESPUÉS del commit; si falla, solo se loguea
    try {
      const full = await this.apptRepo.findOne({
        where: { id: saved.id },
        relations: { client: true, staff: { user: true }, service: true },
      });
      if (full) {
        await this.mailService.sendConfirmation({
          appointmentId: full.id,
          clientName: full.client.name,
          clientEmail: full.client.email,
          staffName: full.staff.user.name,
          serviceName: full.service.name,
          startTime: full.startTime,
        });
      }
    } catch (err) {
      this.logger.error(`Error preparando email de confirmación para turno #${saved.id}`, err);
    }

    return saved;
  }

  // ---------------------------------------------------------------------------
  // Cambios de estado
  // ---------------------------------------------------------------------------

  async confirmAppointment(id: number): Promise<Appointment> {
    const appt = await this.findById(id);
    if (appt.status !== AppointmentStatus.PENDING) {
      throw new ConflictException(
        `Solo se puede confirmar un turno PENDING (estado actual: ${appt.status})`,
      );
    }
    appt.status = AppointmentStatus.CONFIRMED;
    return this.apptRepo.save(appt);
  }

  async cancelAppointment(
    id: number,
    requesterId: number,
    requesterRole: UserRole,
  ): Promise<Appointment> {
    const appt = await this.findById(id);

    if (requesterRole === UserRole.CLIENT && appt.clientId !== requesterId) {
      throw new ForbiddenException('Solo podés cancelar tus propios turnos');
    }

    const cancellable = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];
    if (!cancellable.includes(appt.status)) {
      throw new ConflictException(
        `No se puede cancelar un turno en estado ${appt.status}`,
      );
    }

    appt.status = AppointmentStatus.CANCELLED;
    return this.apptRepo.save(appt);
  }

  async completeAppointment(id: number): Promise<Appointment> {
    const appt = await this.findById(id);
    if (appt.status !== AppointmentStatus.CONFIRMED) {
      throw new ConflictException(
        `Solo se puede completar un turno CONFIRMED (estado actual: ${appt.status})`,
      );
    }
    appt.status = AppointmentStatus.COMPLETED;
    return this.apptRepo.save(appt);
  }

  // ---------------------------------------------------------------------------
  // Helper compartido — acepta EntityManager para usarse dentro de transacciones
  // ---------------------------------------------------------------------------

  findActiveOverlaps(
    staffProfileId: number,
    startTime: Date,
    endTime: Date,
    excludeId?: number,
    manager?: EntityManager,
  ): Promise<Appointment[]> {
    const repo = manager ? manager.getRepository(Appointment) : this.apptRepo;
    const qb = repo
      .createQueryBuilder('a')
      .where('a.staffProfileId = :staffProfileId', { staffProfileId })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
      })
      .andWhere('a.startTime < :endTime', { endTime })
      .andWhere('a.endTime > :startTime', { startTime });

    if (excludeId) {
      qb.andWhere('a.id != :excludeId', { excludeId });
    }

    return qb.getMany();
  }
}
