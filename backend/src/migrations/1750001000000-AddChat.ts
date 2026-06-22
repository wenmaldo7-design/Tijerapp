import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChat1750001000000 implements MigrationInterface {
  name = 'AddChat1750001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`conversations\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`clientId\` int NOT NULL,
        \`staffProfileId\` int NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_conversations_client_staff\` (\`clientId\`, \`staffProfileId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_conversations_clientId\` FOREIGN KEY (\`clientId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_conversations_staffProfileId\` FOREIGN KEY (\`staffProfileId\`) REFERENCES \`staff_profiles\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`messages\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`conversationId\` int NOT NULL,
        \`senderId\` int NOT NULL,
        \`content\` text NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`readAt\` datetime NULL DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_messages_conversationId\` FOREIGN KEY (\`conversationId\`) REFERENCES \`conversations\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_messages_senderId\` FOREIGN KEY (\`senderId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`messages\``);
    await queryRunner.query(`DROP TABLE \`conversations\``);
  }
}
