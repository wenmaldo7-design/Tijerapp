import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

// @Global hace que MailService esté disponible en cualquier módulo
// sin necesidad de importar MailModule explícitamente.
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
