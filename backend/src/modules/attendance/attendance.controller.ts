import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Attendance Management')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Mark or bulk-update class attendance for a date' })
  markAttendance(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.markOrUpdateAttendance(dto, user);
  }

  @Get('session')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Get attendance roster for a specific classBatchId and date' })
  getSession(
    @Query('classBatchId') classBatchId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getSessionByClassAndDate(classBatchId, date);
  }

  @Get()
  @ApiOperation({ summary: 'Get attendance records, monthly breakdown, and summary (role-scoped)' })
  getAttendance(
    @Query('classBatchId') classBatchId?: string,
    @Query('studentId') studentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('month') month?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.attendanceService.getAttendanceList(
      { classBatchId, studentId, startDate, endDate, month },
      user!,
    );
  }
}
