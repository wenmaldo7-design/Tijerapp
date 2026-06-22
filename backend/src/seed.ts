import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { UserRole } from './users/user-role.enum';

const SEED_USERS = [
  {
    name: 'Admin Tijerapp',
    email: 'admin@tijerapp.com',
    password: 'admin123',
    role: UserRole.ADMIN,
  },
  {
    name: 'Staff Tijerapp',
    email: 'staff@tijerapp.com',
    password: 'staff123',
    role: UserRole.STAFF,
  },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const usersService = app.get(UsersService);

  for (const u of SEED_USERS) {
    try {
      const passwordHash = await bcrypt.hash(u.password, 10);
      await usersService.create({
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
      });
      console.log(`✓  Created ${u.role.padEnd(6)}: ${u.email}`);
    } catch (err: any) {
      const isConflict = err?.status === 409 || err?.message?.includes('ya está registrado');
      if (isConflict) {
        console.log(`•  Already exists (skipped): ${u.email}`);
      } else {
        console.error(`✗  Failed to create ${u.email}:`, err?.message ?? err);
      }
    }
  }

  await app.close();
  console.log('\nSeed finished.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
