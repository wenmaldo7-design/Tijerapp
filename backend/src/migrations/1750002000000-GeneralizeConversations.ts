import { MigrationInterface, QueryRunner } from 'typeorm';

export class GeneralizeConversations1750002000000 implements MigrationInterface {
  name = 'GeneralizeConversations1750002000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new nullable columns
    await queryRunner.query(`
      ALTER TABLE \`conversations\`
        ADD COLUMN \`participantAId\` int NULL AFTER \`id\`,
        ADD COLUMN \`participantBId\` int NULL AFTER \`participantAId\`
    `);

    // 2. Populate from existing data (always store lower userId as A)
    await queryRunner.query(`
      UPDATE \`conversations\` c
      INNER JOIN \`staff_profiles\` sp ON sp.id = c.staffProfileId
      SET
        c.participantAId = LEAST(c.clientId, sp.userId),
        c.participantBId = GREATEST(c.clientId, sp.userId)
    `);

    // 3. Add FK constraints
    await queryRunner.query(`
      ALTER TABLE \`conversations\`
        ADD CONSTRAINT \`FK_conversations_participantAId\`
          FOREIGN KEY (\`participantAId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        ADD CONSTRAINT \`FK_conversations_participantBId\`
          FOREIGN KEY (\`participantBId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
    `);

    // 4. Set NOT NULL now that data is populated
    await queryRunner.query(`
      ALTER TABLE \`conversations\`
        MODIFY COLUMN \`participantAId\` int NOT NULL,
        MODIFY COLUMN \`participantBId\` int NOT NULL
    `);

    // 5. Drop old unique index and add new one
    await queryRunner.query(`DROP INDEX \`IDX_conversations_client_staff\` ON \`conversations\``);
    await queryRunner.query(`
      CREATE UNIQUE INDEX \`IDX_conversations_participants\`
        ON \`conversations\` (\`participantAId\`, \`participantBId\`)
    `);

    // 6. Drop old FK constraints
    await queryRunner.query(`
      ALTER TABLE \`conversations\`
        DROP FOREIGN KEY \`FK_conversations_clientId\`,
        DROP FOREIGN KEY \`FK_conversations_staffProfileId\`
    `);

    // 7. Drop old columns
    await queryRunner.query(`
      ALTER TABLE \`conversations\`
        DROP COLUMN \`clientId\`,
        DROP COLUMN \`staffProfileId\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add old columns
    await queryRunner.query(`
      ALTER TABLE \`conversations\`
        ADD COLUMN \`clientId\` int NULL AFTER \`id\`,
        ADD COLUMN \`staffProfileId\` int NULL AFTER \`clientId\`
    `);

    // Best-effort reverse: participantA or participantB that is a CLIENT goes to clientId
    // and the STAFF user maps back to staffProfileId. This is lossy for admin↔staff convs.
    await queryRunner.query(`
      UPDATE \`conversations\` c
      INNER JOIN \`users\` ua ON ua.id = c.participantAId
      INNER JOIN \`users\` ub ON ub.id = c.participantBId
      INNER JOIN \`staff_profiles\` sp
        ON sp.userId = (CASE WHEN ua.role = 'STAFF' THEN ua.id ELSE ub.id END)
      SET
        c.clientId = CASE WHEN ua.role = 'CLIENT' THEN ua.id ELSE ub.id END,
        c.staffProfileId = sp.id
      WHERE ua.role IN ('CLIENT','STAFF') OR ub.role IN ('CLIENT','STAFF')
    `);

    await queryRunner.query(`DROP INDEX \`IDX_conversations_participants\` ON \`conversations\``);
    await queryRunner.query(`
      CREATE UNIQUE INDEX \`IDX_conversations_client_staff\`
        ON \`conversations\` (\`clientId\`, \`staffProfileId\`)
    `);

    await queryRunner.query(`
      ALTER TABLE \`conversations\`
        MODIFY COLUMN \`clientId\` int NOT NULL,
        MODIFY COLUMN \`staffProfileId\` int NOT NULL,
        ADD CONSTRAINT \`FK_conversations_clientId\`
          FOREIGN KEY (\`clientId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        ADD CONSTRAINT \`FK_conversations_staffProfileId\`
          FOREIGN KEY (\`staffProfileId\`) REFERENCES \`staff_profiles\` (\`id\`) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE \`conversations\`
        DROP FOREIGN KEY \`FK_conversations_participantAId\`,
        DROP FOREIGN KEY \`FK_conversations_participantBId\`,
        DROP COLUMN \`participantAId\`,
        DROP COLUMN \`participantBId\`
    `);
  }
}
