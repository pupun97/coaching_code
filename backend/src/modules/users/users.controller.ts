import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { StorageService } from '../../providers/storage/storage.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'List all users with pagination, search, role & status filters' })
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.usersService.findAll({ ...query, role, status });
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get detailed user profile by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a new user and initialize role profile' })
  create(@Body() dto: any, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.create(dto, actor);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update user details or role' })
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.update(id, dto, actor);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Activate or deactivate a user account' })
  toggleStatus(
    @Param('id') id: string,
    @Body('status') status: 'ACTIVE' | 'INACTIVE',
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.toggleStatus(id, status, actor);
  }

  @Post(':id/reset-password')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Admin password reset for a user' })
  resetPassword(
    @Param('id') id: string,
    @Body('newPassword') newPassword: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.adminResetPassword(id, newPassword, actor);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload user profile photo' })
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const uploaded = await this.storageService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      'avatars',
    );
    return this.usersService.update(id, { avatarUrl: uploaded.url }, actor);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Soft delete and archive user account' })
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.softDelete(id, actor);
  }
}
