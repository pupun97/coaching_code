import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'edunexus-dev-access-secret-key-2026-secure-token-32chars',
    });
  }

  async validate(payload: any): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        studentProfile: { select: { id: true } },
        teacherProfile: { select: { id: true } },
        parentProfile: { select: { id: true } },
      },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive or no longer valid');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role as any,
      firstName: user.firstName,
      lastName: user.lastName,
      studentId: user.studentProfile?.id,
      teacherId: user.teacherProfile?.id,
      parentId: user.parentProfile?.id,
    };
  }
}
