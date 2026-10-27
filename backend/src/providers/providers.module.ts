import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage/storage.service';
import { EmailService } from './email/email.service';

@Global()
@Module({
  providers: [StorageService, EmailService],
  exports: [StorageService, EmailService],
})
export class ProvidersModule {}
