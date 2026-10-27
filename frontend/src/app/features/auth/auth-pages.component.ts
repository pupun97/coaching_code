import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <a routerLink="/" class="logo-badge" style="text-decoration:none">EN</a>
          <div>
            <h1>EduNexus Portal Login</h1>
            <p>Sign in with your Email, Username, or Phone Number</p>
          </div>
        </div>

        @if (mode() === 'LOGIN') {
          <form (ngSubmit)="onLogin()">
            <div class="form-group">
              <label for="identifier">Email / Username / Phone <span class="req">*</span></label>
              <input
                id="identifier"
                type="text"
                [(ngModel)]="identifier"
                name="identifier"
                required
                placeholder="e.g. admin@edunexus.edu or dr.sharma"
              />
            </div>

            <div class="form-group">
              <label for="password">Password <span class="req">*</span></label>
              <input
                id="password"
                type="password"
                [(ngModel)]="password"
                name="password"
                required
                placeholder="Enter your password"
              />
            </div>

            <div class="auth-row">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="rememberMe" name="rememberMe" />
                <span>Remember me for 30 days</span>
              </label>
              <button type="button" class="link-btn" (click)="mode.set('FORGOT')">
                Forgot password?
              </button>
            </div>

            <button type="submit" class="btn btn-primary w-full" [disabled]="loading()">
              {{ loading() ? 'Authenticating...' : 'Sign In to Portal' }}
            </button>
          </form>

          <!-- Quick Demo Credentials Selector for Development/QA -->
          <div class="demo-box">
            <div class="demo-title">⚡ Quick Demo Role Login (Development Seed)</div>
            <div class="demo-chips">
              <button type="button" class="chip" (click)="fillDemo('superadmin@edunexus.edu', 'Admin@123')">
                Super Admin
              </button>
              <button type="button" class="chip" (click)="fillDemo('admin@edunexus.edu', 'Admin@123')">
                Center Admin
              </button>
              <button type="button" class="chip" (click)="fillDemo('dr.sharma@edunexus.edu', 'Teacher@123')">
                Teacher (Physics)
              </button>
              <button type="button" class="chip" (click)="fillDemo('student1@edunexus.edu', 'Student@123')">
                Student (Aarav)
              </button>
              <button type="button" class="chip" (click)="fillDemo('parent1@edunexus.edu', 'Parent@123')">
                Parent (2 Children)
              </button>
            </div>
          </div>
        }

        @if (mode() === 'FORGOT') {
          <div>
            <h3>Reset Your Password</h3>
            <p style="font-size:0.86rem;color:#475569;margin-bottom:16px">
              Enter your registered email address to receive a password reset token.
            </p>
            <div class="form-group">
              <label>Registered Email <span class="req">*</span></label>
              <input type="email" [(ngModel)]="resetEmail" placeholder="you@edunexus.edu" />
            </div>
            <div style="display:flex;gap:10px">
              <button type="button" class="btn btn-primary" (click)="onRequestReset()">Send Reset Token</button>
              <button type="button" class="btn btn-secondary" (click)="mode.set('LOGIN')">Back to Login</button>
            </div>
          </div>
        }

        @if (mode() === 'RESET') {
          <div>
            <h3>Set New Password</h3>
            <div class="form-group">
              <label>Reset Token <span class="req">*</span></label>
              <input type="text" [(ngModel)]="resetToken" placeholder="Paste reset token" />
            </div>
            <div class="form-group">
              <label>New Strong Password <span class="req">*</span></label>
              <input type="password" [(ngModel)]="newPassword" placeholder="Min 8 chars, uppercase, lowercase & number" />
            </div>
            <div style="display:flex;gap:10px">
              <button type="button" class="btn btn-primary" (click)="onCompleteReset()">Reset Password</button>
              <button type="button" class="btn btn-secondary" (click)="mode.set('LOGIN')">Cancel</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: calc(100vh - 140px);
      display: flex; align-items: center; justify-content: center;
      padding: 40px 20px; background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
    }
    .auth-card {
      width: 100%; max-width: 460px; background: #fff;
      border-radius: 16px; border: 1px solid #e2e8f0;
      box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.08);
      padding: 32px;
    }
    .auth-brand {
      display: flex; align-items: center; gap: 14px; margin-bottom: 24px;
      h1 { font-size: 1.35rem; margin: 0 0 4px; }
      p { margin: 0; font-size: 0.85rem; color: #64748b; }
    }
    .logo-badge {
      width: 44px; height: 44px; border-radius: 12px;
      background: linear-gradient(135deg, #4f46e5, #0891b2);
      color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center;
    }
    .auth-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 18px; font-size: 0.84rem;
    }
    .checkbox-label { display: flex; align-items: center; gap: 6px; cursor: pointer; color: #475569; }
    .link-btn { background: none; border: none; color: #4f46e5; font-weight: 600; cursor: pointer; }
    .w-full { width: 100%; padding: 11px; font-size: 0.95rem; }
    .demo-box {
      margin-top: 24px; padding-top: 18px; border-top: 1px dashed #cbd5e1;
      .demo-title { font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 10px; text-transform: uppercase; }
      .demo-chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .chip {
        padding: 6px 11px; border-radius: 999px; font-size: 0.76rem; font-weight: 600;
        border: 1px solid #c7d2fe; background: #eef2ff; color: #3730a3; cursor: pointer;
        &:hover { background: #4f46e5; color: #fff; }
      }
    }
  `],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly mode = signal<'LOGIN' | 'FORGOT' | 'RESET'>('LOGIN');
  readonly loading = signal(false);

  identifier = '';
  password = '';
  rememberMe = false;

  resetEmail = '';
  resetToken = '';
  newPassword = '';

  fillDemo(email: string, pass: string) {
    this.identifier = email;
    this.password = pass;
    this.onLogin();
  }

  onLogin() {
    if (!this.identifier || !this.password) {
      this.toast.warning('Credentials Required', 'Please enter your identifier and password.');
      return;
    }
    this.loading.set(true);
    this.auth.login(this.identifier, this.password, this.rememberMe).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.router.navigateByUrl(res.redirectUrl || this.auth.getDefaultDashboardRoute());
      },
      error: () => this.loading.set(false),
    });
  }

  onRequestReset() {
    if (!this.resetEmail) return;
    this.auth.forgotPassword(this.resetEmail).subscribe((res) => {
      this.toast.info('Reset Requested', res.message);
      if (res.devResetToken) {
        this.resetToken = res.devResetToken;
      }
      this.mode.set('RESET');
    });
  }

  onCompleteReset() {
    if (!this.resetToken || !this.newPassword) return;
    this.auth.resetPassword(this.resetToken, this.newPassword).subscribe((res) => {
      this.toast.success('Password Reset', res.message);
      this.mode.set('LOGIN');
    });
  }
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container" style="max-width:960px">
      <div class="page-header">
        <div>
          <h1 class="page-title">My Account Profile & Security</h1>
          <p class="page-subtitle">Manage your personal contact information and account password</p>
        </div>
        <span class="badge badge-primary">{{ auth.userRole() }} ACCOUNT</span>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>Personal Details</h3>
          <form (ngSubmit)="saveProfile()">
            <div class="form-grid">
              <div class="form-group">
                <label>First Name <span class="req">*</span></label>
                <input type="text" [(ngModel)]="profileForm.firstName" name="firstName" required />
              </div>
              <div class="form-group">
                <label>Last Name <span class="req">*</span></label>
                <input type="text" [(ngModel)]="profileForm.lastName" name="lastName" required />
              </div>
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" [value]="auth.currentUser()?.email" disabled />
            </div>
            <div class="form-group">
              <label>Phone Number</label>
              <input type="text" [(ngModel)]="profileForm.phone" name="phone" />
            </div>
            <div class="form-group">
              <label>Residential Address</label>
              <textarea rows="3" [(ngModel)]="profileForm.address" name="address"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Save Profile Changes</button>
          </form>
        </div>

        <div class="card">
          <h3>Change Password</h3>
          <p style="font-size:0.84rem;color:#64748b;margin-bottom:16px">
            Passwords must be at least 8 characters and include uppercase, lowercase, and a number.
          </p>
          <form (ngSubmit)="updatePassword()">
            <div class="form-group">
              <label>Current Password <span class="req">*</span></label>
              <input type="password" [(ngModel)]="pwdForm.currentPassword" name="currentPassword" required />
            </div>
            <div class="form-group">
              <label>New Password <span class="req">*</span></label>
              <input type="password" [(ngModel)]="pwdForm.newPassword" name="newPassword" required />
            </div>
            <button type="submit" class="btn btn-secondary">Update Password</button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  profileForm = {
    firstName: this.auth.currentUser()?.firstName || '',
    lastName: this.auth.currentUser()?.lastName || '',
    phone: this.auth.currentUser()?.phone || '',
    address: this.auth.currentUser()?.address || '',
  };

  pwdForm = {
    currentPassword: '',
    newPassword: '',
  };

  saveProfile() {
    this.auth.updateProfile(this.profileForm).subscribe(() => {
      this.toast.success('Profile Updated', 'Your personal details have been saved.');
    });
  }

  updatePassword() {
    if (!this.pwdForm.currentPassword || !this.pwdForm.newPassword) return;
    this.auth.changePassword(this.pwdForm.currentPassword, this.pwdForm.newPassword).subscribe(() => {
      this.toast.success('Password Changed', 'Your password was updated successfully.');
      this.pwdForm = { currentPassword: '', newPassword: '' };
    });
  }
}
