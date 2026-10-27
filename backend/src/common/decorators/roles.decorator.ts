import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
