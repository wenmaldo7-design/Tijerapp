import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ServicesModule } from './services/services.module';
import { StaffModule } from './staff/staff.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { MailModule } from './mail/mail.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // ENV_FILE permite levantar el backend contra otro entorno (ej. .env.test
      // para E2E) sin tocar el .env de desarrollo.
      envFilePath: process.env.ENV_FILE || '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // En producción no se auto-sincroniza el esquema (se asume migración manual).
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: false,
      }),
    }),
    AuthModule,
    UsersModule,
    ServicesModule,
    StaffModule,
    AppointmentsModule,
    MailModule,
    ChatModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
