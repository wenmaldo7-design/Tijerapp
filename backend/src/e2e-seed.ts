import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from './app.module';
import { User } from './users/entities/user.entity';
import { UserRole } from './users/user-role.enum';
import { StaffProfile } from './staff/entities/staff-profile.entity';
import { WorkingHours } from './staff/entities/working-hours.entity';
import { Service } from './services/entities/service.entity';

// Fixtures fijos para los tests E2E (Playwright). Corre contra tijerapp_test
// (ver .env.test) — nunca contra la DB de desarrollo. Pensado para ejecutarse
// antes de cada corrida de la suite: deja la DB en un estado limpio y conocido.

const TABLES_IN_FK_ORDER = [
  'appointments',
  'time_offs',
  'working_hours',
  'staff_profiles',
  'services',
  'users',
];

async function resetTables(dataSource: DataSource): Promise<void> {
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES_IN_FK_ORDER) {
    await dataSource.query(`TRUNCATE TABLE \`${table}\``);
  }
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const dataSource = app.get(DataSource);

  console.log('Limpiando tablas de tijerapp_test...');
  await resetTables(dataSource);

  const userRepo = dataSource.getRepository(User);
  const profileRepo = dataSource.getRepository(StaffProfile);
  const whRepo = dataSource.getRepository(WorkingHours);
  const serviceRepo = dataSource.getRepository(Service);

  await userRepo.save(
    userRepo.create({
      name: 'Admin E2E',
      email: 'admin@tijerapp.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: UserRole.ADMIN,
    }),
  );

  const staffUser = await userRepo.save(
    userRepo.create({
      name: 'Staff E2E',
      email: 'staff@tijerapp.com',
      passwordHash: await bcrypt.hash('staff123', 10),
      role: UserRole.STAFF,
    }),
  );

  await userRepo.save(
    userRepo.create({
      name: 'Cliente E2E',
      email: 'client@tijerapp.com',
      passwordHash: await bcrypt.hash('client123', 10),
      role: UserRole.CLIENT,
    }),
  );

  const profile = await profileRepo.save(
    profileRepo.create({
      userId: staffUser.id,
      specialties: ['corte', 'barba'],
      bio: 'Peluquero de fixtures E2E',
    }),
  );

  // Lun–Vie: mañana (10-13) + tarde (15-19). Sáb: solo mañana. Dom: sin bloques.
  // Los tests usan los 7 días para no depender del día en que corran.
  for (let day = 0; day <= 6; day++) {
    if (day === 0) continue; // domingo sin horario
    await whRepo.save(
      whRepo.create({ staffProfileId: profile.id, dayOfWeek: day, startTime: '10:00', endTime: '13:00' }),
    );
    if (day !== 6) { // sábado solo medio día
      await whRepo.save(
        whRepo.create({ staffProfileId: profile.id, dayOfWeek: day, startTime: '15:00', endTime: '19:00' }),
      );
    }
  }

  await serviceRepo.save(
    serviceRepo.create({
      name: 'Corte de cabello',
      description: 'Corte clásico con tijera o máquina',
      durationMinutes: 30,
      price: 1500,
    }),
  );

  await serviceRepo.save(
    serviceRepo.create({
      name: 'Tinte completo',
      description: 'Coloración completa con productos premium',
      durationMinutes: 90,
      price: 5000,
    }),
  );

  console.log('Fixtures de E2E creados.');
  await app.close();
}

seed().catch((err) => {
  console.error('e2e-seed falló:', err);
  process.exit(1);
});
