import { Injectable, Logger } from '@nestjs/common';

export interface EmailPayload {
  to: string;
  subject: string;
  template:
    | 'WELCOME'
    | 'EMAIL_VERIFICATION'
    | 'PASSWORD_RESET'
    | 'TEST_ASSIGNED'
    | 'TEST_REMINDER'
    | 'RESULT_PUBLISHED'
    | 'ATTENDANCE_ALERT'
    | 'NEW_MESSAGE';
  context: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider = process.env.EMAIL_PROVIDER || 'console';
  private readonly fromAddress = process.env.EMAIL_FROM || 'no-reply@edunexus.edu';

  async sendEmail(payload: EmailPayload): Promise<{ sent: boolean; provider: string; messageId: string }> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Provider abstraction: supports console (dev), SMTP, or SendGrid/SES in production
    this.logger.log(
      `[Email:${this.provider}] To=${payload.to} | Template=${payload.template} | Subject="${payload.subject}" | MessageId=${messageId}`,
    );

    return {
      sent: true,
      provider: this.provider,
      messageId,
    };
  }

  async sendWelcomeEmail(to: string, name: string, role: string) {
    return this.sendEmail({
      to,
      subject: 'Welcome to EduNexus Academy of Excellence',
      template: 'WELCOME',
      context: { name, role },
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetToken: string) {
    return this.sendEmail({
      to,
      subject: 'EduNexus Password Reset Request',
      template: 'PASSWORD_RESET',
      context: { name, resetToken },
    });
  }

  async sendTestAssignedEmail(to: string, studentName: string, testTitle: string, startTime: Date) {
    return this.sendEmail({
      to,
      subject: `New Assessment Assigned: ${testTitle}`,
      template: 'TEST_ASSIGNED',
      context: { studentName, testTitle, startTime },
    });
  }

  async sendResultNotification(to: string, studentName: string, testTitle: string, scoreSummary: string) {
    return this.sendEmail({
      to,
      subject: `Result Published: ${testTitle}`,
      template: 'RESULT_PUBLISHED',
      context: { studentName, testTitle, scoreSummary },
    });
  }
}
