import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { AppointmentsService } from './appointments.service';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { WorkingHours } from '../staff/entities/working-hours.entity';
import { TimeOff } from '../staff/entities/time-off.entity';
import { Service } from '../services/entities/service.entity';
import { StaffProfile } from '../staff/entities/staff-profile.entity';
import { MailService } from '../mail/mail.service';
import { UserRole } from '../users/user-role.enum';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a chainable QueryBuilder mock. */
function makeQb(partial: Partial<any> = {}): any {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getMany: jest.fn().mockResolvedValue([]),
    ...partial,
  };
}

/** Builds a TypeORM EntityManager mock for use inside transactions. */
function makeManager(partial: Partial<any> = {}): any {
  const overlapsQb = makeQb(); // no overlaps by default
  return {
    findOne: jest.fn().mockResolvedValue({ id: 1 }), // StaffProfile found
    create: jest.fn().mockImplementation((_Entity: any, data: any) => ({ ...data })),
    save: jest.fn().mockImplementation((appt: any) => Promise.resolve({ id: 99, ...appt })),
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue(overlapsQb),
    }),
    ...partial,
  };
}

/** Returns an ISO datetime string that is always in the future. */
function futureStartStr(): string {
  const d = new Date(Date.now() + 365 * 24 * 60 * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00:00`;
}

/** Builds a minimal Appointment stub for status-change tests. */
function makeAppt(status: AppointmentStatus, clientId = 1): Appointment {
  return { id: 1, clientId, status } as Appointment;
}

// Fixed future date for slot tests (no past-date check in getAvailableSlots)
const SLOT_DATE = '2030-07-15';
const SLOT_QUERY = { staffProfileId: 1, serviceId: 1, date: SLOT_DATE };
const ACTIVE_SERVICE = { id: 1, durationMinutes: 60, isActive: true };

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  let apptRepo: any;
  let whRepo: any;
  let timeOffRepo: any;
  let serviceRepo: any;
  let dataSource: any;
  let mailService: any;

  beforeEach(async () => {
    apptRepo = {
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((a: any) => Promise.resolve(a)),
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
    };
    whRepo = { find: jest.fn().mockResolvedValue([]) };
    timeOffRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
    };
    serviceRepo = { findOneBy: jest.fn().mockResolvedValue(null) };
    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: any) => cb(makeManager())),
    };
    mailService = { sendConfirmation: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: getRepositoryToken(Appointment),   useValue: apptRepo },
        { provide: getRepositoryToken(WorkingHours),  useValue: whRepo },
        { provide: getRepositoryToken(TimeOff),       useValue: timeOffRepo },
        { provide: getRepositoryToken(Service),       useValue: serviceRepo },
        { provide: getRepositoryToken(StaffProfile),  useValue: {} },
        { provide: DataSource,  useValue: dataSource },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  // =========================================================================
  // TANDA 1 — Motor de disponibilidad (getAvailableSlots)
  // =========================================================================

  describe('getAvailableSlots', () => {
    /** Sets up the "happy path" mocks; caller may override individual repos. */
    function happyPath(whBlocks: any[], dayAppts: any[] = []) {
      whRepo.find.mockResolvedValue(whBlocks);
      timeOffRepo.createQueryBuilder.mockReturnValue(makeQb({ getCount: jest.fn().mockResolvedValue(0) }));
      serviceRepo.findOneBy.mockResolvedValue(ACTIVE_SERVICE);
      apptRepo.createQueryBuilder.mockReturnValue(makeQb({ getMany: jest.fn().mockResolvedValue(dayAppts) }));
    }

    it('returns [] when there are no WorkingHours for that dayOfWeek', async () => {
      whRepo.find.mockResolvedValue([]);
      expect(await service.getAvailableSlots(SLOT_QUERY)).toEqual([]);
    });

    it('returns [] when the day is fully blocked by a TimeOff', async () => {
      whRepo.find.mockResolvedValue([{ startTime: '09:00', endTime: '17:00' }]);
      timeOffRepo.createQueryBuilder.mockReturnValue(
        makeQb({ getCount: jest.fn().mockResolvedValue(1) }),
      );
      expect(await service.getAvailableSlots(SLOT_QUERY)).toEqual([]);
    });

    it('returns [] when the service is inactive or does not exist', async () => {
      happyPath([{ startTime: '09:00', endTime: '17:00' }]);
      serviceRepo.findOneBy.mockResolvedValue(null);
      expect(await service.getAvailableSlots(SLOT_QUERY)).toEqual([]);
    });

    it('generates correct slots within a single block (interval = 60 min)', async () => {
      happyPath([{ startTime: '09:00', endTime: '11:00' }]);
      // duration 60, interval 60 → two slots: 09:00–10:00 and 10:00–11:00
      const slots = await service.getAvailableSlots(SLOT_QUERY, 60);
      expect(slots).toEqual([
        { startTime: `${SLOT_DATE}T09:00:00`, endTime: `${SLOT_DATE}T10:00:00` },
        { startTime: `${SLOT_DATE}T10:00:00`, endTime: `${SLOT_DATE}T11:00:00` },
      ]);
    });

    it('split shifts: generates slots in both blocks but none in the gap between them', async () => {
      happyPath([
        { startTime: '09:00', endTime: '11:00' },
        { startTime: '14:00', endTime: '16:00' },
      ]);
      const slots = await service.getAvailableSlots(SLOT_QUERY, 60);

      expect(slots).toHaveLength(4);
      // None of the returned slots should start in the 11:00–14:00 gap
      const starts = slots.map((s) => s.startTime);
      expect(starts.some((t) => t >= `${SLOT_DATE}T11:00:00` && t < `${SLOT_DATE}T14:00:00`)).toBe(false);
    });

    it('does NOT offer a slot whose endTime would exceed the block close', async () => {
      // Block 09:00–09:45, service 60 min: 09:00 + 60 = 10:00 > 09:45 → no slot
      happyPath([{ startTime: '09:00', endTime: '09:45' }]);
      expect(await service.getAvailableSlots(SLOT_QUERY, 15)).toEqual([]);
    });

    it('blocks slots that overlap a PENDING or CONFIRMED appointment', async () => {
      // Block 09:00–12:00, interval 60 min → candidates: 09:00, 10:00, 11:00
      // Existing CONFIRMED covers 10:00–11:00 → 10:00 slot is blocked; 09:00 and 11:00 remain
      const existing = {
        startTime: new Date(2030, 6, 15, 10, 0, 0), // local 10:00 → 600 min
        endTime:   new Date(2030, 6, 15, 11, 0, 0), // local 11:00 → 660 min
        status: AppointmentStatus.CONFIRMED,
      };
      happyPath([{ startTime: '09:00', endTime: '12:00' }], [existing]);

      const starts = (await service.getAvailableSlots(SLOT_QUERY, 60)).map((s) => s.startTime);

      expect(starts).toContain(`${SLOT_DATE}T09:00:00`);
      expect(starts).not.toContain(`${SLOT_DATE}T10:00:00`); // blocked
      expect(starts).toContain(`${SLOT_DATE}T11:00:00`);
    });

    it('a CANCELLED appointment does NOT block its slot (SQL filters to PENDING/CONFIRMED)', async () => {
      // The real query uses WHERE status IN (PENDING, CONFIRMED), so a CANCELLED appt
      // never reaches the in-memory overlap check. The mock returns [] as the DB would.
      happyPath([{ startTime: '09:00', endTime: '11:00' }], []);
      const slots = await service.getAvailableSlots(SLOT_QUERY, 60);
      expect(slots).toHaveLength(2); // both 09:00 and 10:00 are offered
    });
  });

  // =========================================================================
  // TANDA 2 — Crear turno (createAppointment)
  // =========================================================================

  describe('createAppointment', () => {
    let startStr: string;

    beforeEach(() => {
      startStr = futureStartStr(); // always in the future
      // Default happy-path: active service, WH contains 10:00–11:00, no TimeOff, no overlaps
      serviceRepo.findOneBy.mockResolvedValue({ id: 1, durationMinutes: 60, isActive: true });
      whRepo.find.mockResolvedValue([{ startTime: '09:00', endTime: '17:00' }]);
      timeOffRepo.createQueryBuilder.mockReturnValue(makeQb({ getCount: jest.fn().mockResolvedValue(0) }));
      dataSource.transaction.mockImplementation(async (cb: any) => cb(makeManager()));
      apptRepo.findOne.mockResolvedValue(null); // email reload: skip if null
    });

    it('rejects a startTime in the past with 400', async () => {
      await expect(
        service.createAppointment(1, {
          staffProfileId: 1, serviceId: 1, startTime: '2020-01-01T10:00:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an inactive or non-existent service with 404', async () => {
      serviceRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.createAppointment(1, { staffProfileId: 1, serviceId: 1, startTime: startStr }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a non-existent staff profile with 404 (checked inside the transaction)', async () => {
      // The pessimistic-write findOne for StaffProfile returns null
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeManager({ findOne: jest.fn().mockResolvedValue(null) })),
      );
      await expect(
        service.createAppointment(1, { staffProfileId: 1, serviceId: 1, startTime: startStr }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the slot does not fit within any WorkingHours block with 400', async () => {
      // startTime is 10:00; block only covers 09:00–09:30 → endMin 660 > blockEnd 570
      whRepo.find.mockResolvedValue([{ startTime: '09:00', endTime: '09:30' }]);
      await expect(
        service.createAppointment(1, { staffProfileId: 1, serviceId: 1, startTime: startStr }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the day is blocked by TimeOff with 409', async () => {
      timeOffRepo.createQueryBuilder.mockReturnValue(
        makeQb({ getCount: jest.fn().mockResolvedValue(1) }),
      );
      await expect(
        service.createAppointment(1, { staffProfileId: 1, serviceId: 1, startTime: startStr }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects when an overlap with a PENDING/CONFIRMED appointment is detected with 409', async () => {
      // Note: concurrency race-condition correctness is only provable with a real DB
      // and a pessimistic-write lock. This test covers the overlap-rejection logic only.
      const overlapQb = makeQb({ getMany: jest.fn().mockResolvedValue([{ id: 42 }]) });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(
          makeManager({
            getRepository: jest.fn().mockReturnValue({
              createQueryBuilder: jest.fn().mockReturnValue(overlapQb),
            }),
          }),
        ),
      );
      await expect(
        service.createAppointment(1, { staffProfileId: 1, serviceId: 1, startTime: startStr }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates the appointment with status PENDING and endTime = startTime + durationMinutes', async () => {
      const result = await service.createAppointment(42, {
        staffProfileId: 1,
        serviceId: 1,
        startTime: startStr,
        notes: 'Sin alergia',
      });

      expect(result.status).toBe(AppointmentStatus.PENDING);
      expect(result.clientId).toBe(42);

      const expectedEnd = new Date(new Date(startStr).getTime() + 60 * 60_000);
      expect((result.endTime as Date).getTime()).toBe(expectedEnd.getTime());
    });
  });

  // =========================================================================
  // TANDA 3 — Cambios de estado
  // =========================================================================

  describe('confirmAppointment', () => {
    it('transitions PENDING → CONFIRMED', async () => {
      apptRepo.findOne.mockResolvedValue(makeAppt(AppointmentStatus.PENDING));
      const result = await service.confirmAppointment(1);
      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
    });

    it.each([AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED])(
      'throws 409 when confirming a %s appointment',
      async (status) => {
        apptRepo.findOne.mockResolvedValue(makeAppt(status));
        await expect(service.confirmAppointment(1)).rejects.toThrow(ConflictException);
      },
    );
  });

  describe('cancelAppointment', () => {
    it.each([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED])(
      'transitions %s → CANCELLED when STAFF cancels',
      async (status) => {
        apptRepo.findOne.mockResolvedValue(makeAppt(status, 42));
        const result = await service.cancelAppointment(1, 99, UserRole.STAFF);
        expect(result.status).toBe(AppointmentStatus.CANCELLED);
      },
    );

    it('allows a CLIENT to cancel their own appointment', async () => {
      apptRepo.findOne.mockResolvedValue(makeAppt(AppointmentStatus.PENDING, 42));
      const result = await service.cancelAppointment(1, 42, UserRole.CLIENT);
      expect(result.status).toBe(AppointmentStatus.CANCELLED);
    });

    it('throws 403 when a CLIENT tries to cancel someone else\'s appointment', async () => {
      apptRepo.findOne.mockResolvedValue(makeAppt(AppointmentStatus.PENDING, 42));
      await expect(service.cancelAppointment(1, 99, UserRole.CLIENT)).rejects.toThrow(ForbiddenException);
    });

    it.each([AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED])(
      'throws 409 when trying to cancel a %s appointment',
      async (status) => {
        apptRepo.findOne.mockResolvedValue(makeAppt(status));
        await expect(service.cancelAppointment(1, 1, UserRole.ADMIN)).rejects.toThrow(ConflictException);
      },
    );
  });

  describe('completeAppointment', () => {
    it('transitions CONFIRMED → COMPLETED', async () => {
      apptRepo.findOne.mockResolvedValue(makeAppt(AppointmentStatus.CONFIRMED));
      const result = await service.completeAppointment(1);
      expect(result.status).toBe(AppointmentStatus.COMPLETED);
    });

    it.each([AppointmentStatus.PENDING, AppointmentStatus.CANCELLED])(
      'throws 409 when completing a %s appointment',
      async (status) => {
        apptRepo.findOne.mockResolvedValue(makeAppt(status));
        await expect(service.completeAppointment(1)).rejects.toThrow(ConflictException);
      },
    );
  });
});
