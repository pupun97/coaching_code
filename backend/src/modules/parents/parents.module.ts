import { Module } from '@nestjs/common';
import { ParentsService } from './parents.service';
import { ParentsController } from './parents.controller';
import { UsersModule } from '../users/users.module';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [UsersModule, StudentsModule],
  controllers: [ParentsController],
  providers: [ParentsService],
  exports: [ParentsService],
})
export class ParentsModule {}
