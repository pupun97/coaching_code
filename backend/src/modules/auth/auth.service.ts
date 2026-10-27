import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmailService } from '../../providers/email/email.service';
import {
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly maxFailedAttempts = Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5);
  private readonly lockoutMinutes = Number(process.env.ACCOUNT_LOCKOUT_MINUTES || 15);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLogs: AuditLogsService,
    private readonly emailService: EmailService,
  ) {}

  getDashboardRedirect(role: string): string {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return '/admin/dashboard';
      case 'TEACHER':
        return '/teacher/dashboard';
      case 'STUDENT':
        return '/student/dashboard';
      case 'PARENT':
        return '/parent/dashboard';
      default:
        return '/';
    }
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const identifier = dto.identifier.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: identifier },
          { username: identifier },
          { phone: dto.identifier.trim() },
        ],
      },
      include: {
        studentProfile: true,
        teacherProfile: true,
        parentProfile: {
          include: {
            children: {
              include: {
                student: {
                  include: {
                    user: { select: { firstName: true, lastName: true, avatarUrl: true } },
                    enrollments: { include: { classBatch: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMin = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(
        `Account temporarily locked due to multiple failed login attempts. Try again in ${remainingMin} minute(s).`,
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(`Account is currently ${user.status.toLowerCase()}. Please contact the administrator.`);
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= this.maxFailedAttempts;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + this.lockoutMinutes * 60 * 1000)
        : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil,
        },
      });

      await this.auditLogs.record({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: shouldLock ? 'ACCOUNT_LOCKED_FAILED_LOGINS' : 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: { attempts },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts & update lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const tokens = await this.issueTokens(user, dto.rememberMe, ipAddress, userAgent);

    await this.auditLogs.record({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      ...tokens,
      redirectUrl: this.getDashboardRedirect(user.role),
      user: this.sanitizeUser(user),
    };
  }

  private async issueTokens(user: any, rememberMe = false, ipAddress?: string, userAgent?: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET || 'edunexus-dev-access-secret-key-2026-secure-token-32chars',
      expiresIn: rememberMe ? '24h' : (process.env.JWT_ACCESS_EXPIRES_IN || '2h'),
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const refreshDays = rememberMe ? 30 : 7;
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: ipAddress || '127.0.0.1',
        userAgent: userAgent || null,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: rememberMe ? 86400 : 7200,
    };
  }

  async refreshTokens(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            studentProfile: true,
            teacherProfile: true,
            parentProfile: {
              include: {
                children: {
                  include: {
                    student: {
                      include: {
                        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate refresh token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.user, false, ipAddress, userAgent);
    return {
      ...tokens,
      user: this.sanitizeUser(stored.user),
    };
  }

  async logout(userId: string, rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    // Always return a generic message to prevent email enumeration
    if (!user || user.deletedAt) {
      return {
        message: 'If an account with that email exists, a password reset token has been sent.',
      };
    }

    const rawResetToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = this.hashToken(rawResetToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await this.emailService.sendPasswordResetEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      rawResetToken,
    );

    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
      // Exposed only in development mode so QA/testers can test the reset flow directly
      ...(process.env.NODE_ENV !== 'production' ? { devResetToken: rawResetToken } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const resetRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditLogs.record({
      userId: resetRecord.userId,
      userEmail: resetRecord.user.email,
      userRole: resetRecord.user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      entity: 'User',
      entityId: resetRecord.userId,
    });

    return { message: 'Password has been reset successfully. You can now sign in.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.auditLogs.record({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entityId: user.id,
    });

    return { message: 'Password updated successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: {
          include: {
            enrollments: { include: { classBatch: true } },
            parents: {
              include: {
                parent: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
              },
            },
          },
        },
        teacherProfile: {
          include: {
            classAssignments: { include: { classBatch: true, subject: true } },
          },
        },
        parentProfile: {
          include: {
            children: {
              include: {
                student: {
                  include: {
                    user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                    enrollments: { include: { classBatch: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return this.sanitizeUser(user);
  }

  async updateMyProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName ? { firstName: dto.firstName } : {}),
        ...(dto.lastName ? { lastName: dto.lastName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });
    return this.sanitizeUser(updated);
  }

  sanitizeUser(user: any) {
    if (!user) return null;
    const { passwordHash, failedLoginAttempts, lockedUntil, ...safe } = user;
    return {
      ...safe,
      fullName: `${user.firstName} ${user.lastName}`,
    };
  }
}
