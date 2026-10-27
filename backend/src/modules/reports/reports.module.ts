import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ReportsController } from './reports.controller';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [StudentsModule],
  controllers: [ReportsController],
  providers: [ReportsService, PdfGeneratorService],
  exports: [ReportsService, PdfGeneratorService],
})
export class ReportsModule {}
