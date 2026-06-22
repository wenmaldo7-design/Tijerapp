import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { config } from 'dotenv';

// Load .env for local migration commands (no-op in prod containers where env vars are injected).
config({ path: process.env.ENV_FILE || '.env' });

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [join(__dirname, '**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false,
});
