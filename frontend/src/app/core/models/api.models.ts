export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  phone?: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  avatarUrl?: string;
  address?: string;
  dateOfBirth?: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING_VERIFICATION';
  lastLoginAt?: string;
  createdAt?: string;
  studentProfile?: any;
  teacherProfile?: any;
  parentProfile?: any;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  redirectUrl: string;
  user: UserProfile;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}
