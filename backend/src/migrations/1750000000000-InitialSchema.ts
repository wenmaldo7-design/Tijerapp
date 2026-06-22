import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1750000000000 implements MigrationInterface {
  name = 'InitialSchema1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`passwordHash\` varchar(255) NOT NULL,
        \`phone\` varchar(255) NULL,
        \`role\` enum('CLIENT','STAFF','ADMIN') NOT NULL DEFAULT 'CLIENT',
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_users_email\` (\`email\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`services\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`description\` text NULL,
        \`durationMinutes\` int NOT NULL,
        \`price\` decimal(10,2) NOT NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_services_name\` (\`name\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`staff_profiles\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`userId\` int NOT NULL,
        \`specialties\` text NULL,
        \`bio\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_staff_profiles_userId\` (\`userId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_staff_profiles_userId\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`working_hours\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`staffProfileId\` int NOT NULL,
        \`dayOfWeek\` int NOT NULL,
        \`startTime\` varchar(5) NOT NULL,
        \`endTime\` varchar(5) NOT NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_working_hours_staffProfileId\` FOREIGN KEY (\`staffProfileId\`) REFERENCES \`staff_profiles\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`time_offs\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`staffProfileId\` int NOT NULL,
        \`startDate\` date NOT NULL,
        \`endDate\` date NOT NULL,
        \`reason\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_time_offs_staffProfileId\` FOREIGN KEY (\`staffProfileId\`) REFERENCES \`staff_profiles\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`appointments\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`clientId\` int NOT NULL,
        \`staffProfileId\` int NOT NULL,
        \`serviceId\` int NOT NULL,
        \`startTime\` datetime NOT NULL,
        \`endTime\` datetime NOT NULL,
        \`status\` enum('PENDING','CONFIRMED','CANCELLED','COMPLETED') NOT NULL DEFAULT 'PENDING',
        \`notes\` text NULL,
        \`reminderSent\` tinyint NOT NULL DEFAULT 0,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_appointments_clientId\` FOREIGN KEY (\`clientId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_appointments_staffProfileId\` FOREIGN KEY (\`staffProfileId\`) REFERENCES \`staff_profiles\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_appointments_serviceId\` FOREIGN KEY (\`serviceId\`) REFERENCES \`services\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`appointments\``);
    await queryRunner.query(`DROP TABLE \`time_offs\``);
    await queryRunner.query(`DROP TABLE \`working_hours\``);
    await queryRunner.query(`DROP TABLE \`staff_profiles\``);
    await queryRunner.query(`DROP TABLE \`services\``);
    await queryRunner.query(`DROP TABLE \`users\``);
  }
}
