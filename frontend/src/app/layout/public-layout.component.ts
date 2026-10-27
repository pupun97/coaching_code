import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="public-wrapper">
      <header class="public-navbar">
        <div class="nav-inner">
          <a routerLink="/" class="brand-logo">
            <span class="logo-badge">{{ branding()?.logoText || 'EN' }}</span>
            <div class="brand-text">
              <span class="brand-name">{{ branding()?.centerName || 'EduNexus Academy' }}</span>
              <span class="brand-tag">IIT-JEE • NEET • Foundation</span>
            </div>
          </a>

          <button class="mobile-toggle" (click)="mobileMenuOpen.set(!mobileMenuOpen())" aria-label="Toggle navigation">
            <span class="material-icons-outlined">{{ mobileMenuOpen() ? 'close' : 'menu' }}</span>
          </button>

          <nav class="nav-links" [class.open]="mobileMenuOpen()">
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="mobileMenuOpen.set(false)">Home</a>
            <a routerLink="/about" routerLinkActive="active" (click)="mobileMenuOpen.set(false)">About Us</a>
            <a routerLink="/courses" routerLinkActive="active" (click)="mobileMenuOpen.set(false)">Courses</a>
            <a routerLink="/faculty" routerLinkActive="active" (click)="mobileMenuOpen.set(false)">Faculty</a>
            <a routerLink="/faq" routerLinkActive="active" (click)="mobileMenuOpen.set(false)">FAQ</a>
            <a routerLink="/contact" routerLinkActive="active" (click)="mobileMenuOpen.set(false)">Contact</a>
          </nav>

          <div class="nav-actions">
            @if (auth.isAuthenticated()) {
              <a [routerLink]="auth.getDefaultDashboardRoute()" class="btn btn-primary">
                <span class="material-icons-outlined" style="font-size:18px">dashboard</span>
                Go to Dashboard
              </a>
            } @else {
              <a routerLink="/contact" class="btn btn-secondary">Enquire Now</a>
              <a routerLink="/login" class="btn btn-primary">
                <span class="material-icons-outlined" style="font-size:18px">login</span>
                Portal Login
              </a>
            }
          </div>
        </div>
      </header>

      <main class="public-main">
        <router-outlet></router-outlet>
      </main>

      <footer class="public-footer">
        <div class="footer-inner">
          <div class="footer-col">
            <div class="brand-logo" style="margin-bottom:12px">
              <span class="logo-badge">{{ branding()?.logoText || 'EN' }}</span>
              <span class="brand-name" style="color:#fff">{{ branding()?.centerName || 'EduNexus Academy of Excellence' }}</span>
            </div>
            <p class="footer-desc">{{ branding()?.tagline || 'Where Conceptual Mastery Meets Top-Rank Performance.' }}</p>
            <p class="footer-contact">{{ branding()?.address }}</p>
            <p class="footer-contact">📞 {{ branding()?.phone }} | ✉️ {{ branding()?.email }}</p>
          </div>
          <div class="footer-col">
            <h4>Programs</h4>
            <a routerLink="/courses">JEE Main & Advanced 2027</a>
            <a routerLink="/courses">NEET UG MedExcel 2027</a>
            <a routerLink="/courses">Class 10 Board & Olympiad Foundation</a>
            <a routerLink="/courses">Computer-Based Test Series</a>
          </div>
          <div class="footer-col">
            <h4>Quick Links</h4>
            <a routerLink="/about">Our Methodology</a>
            <a routerLink="/faculty">Expert Faculty</a>
            <a routerLink="/faq">Admissions FAQ</a>
            <a routerLink="/login">Student & Parent Portal</a>
          </div>
        </div>
        <div class="footer-bottom">
          {{ branding()?.footerText || '© 2026 EduNexus Academy of Excellence. All rights reserved.' }}
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .public-wrapper { min-height: 100vh; display: flex; flex-direction: column; }
    .public-navbar {
      position: sticky; top: 0; z-index: 100;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid #e2e8f0;
    }
    .nav-inner {
      max-width: 1280px; margin: 0 auto; padding: 14px 24px;
      display: flex; align-items: center; justify-content: space-between; gap: 20px;
    }
    .brand-logo {
      display: flex; align-items: center; gap: 12px; text-decoration: none;
    }
    .logo-badge {
      width: 40px; height: 40px; border-radius: 10px;
      background: linear-gradient(135deg, #4f46e5, #0891b2);
      color: #fff; font-weight: 800; font-size: 1.05rem;
      display: flex; align-items: center; justify-content: center;
    }
    .brand-text { display: flex; flex-direction: column; }
    .brand-name { font-weight: 800; font-size: 1.08rem; color: #0f172a; line-height: 1.2; }
    .brand-tag { font-size: 0.72rem; color: #64748b; font-weight: 600; }
    .nav-links {
      display: flex; align-items: center; gap: 24px;
      a {
        text-decoration: none; color: #475569; font-weight: 600; font-size: 0.92rem;
        padding: 6px 0; border-bottom: 2px solid transparent; transition: all 0.15s;
        &:hover, &.active { color: #4f46e5; border-bottom-color: #4f46e5; }
      }
    }
    .nav-actions { display: flex; align-items: center; gap: 10px; }
    .mobile-toggle { display: none; background: none; border: none; cursor: pointer; color: #0f172a; }
    .public-main { flex: 1; }
    .public-footer { background: #0f172a; color: #cbd5e1; padding: 56px 24px 24px; margin-top: 64px; }
    .footer-inner {
      max-width: 1280px; margin: 0 auto;
      display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 40px;
    }
    .footer-col {
      display: flex; flex-direction: column; gap: 8px;
      h4 { color: #fff; font-size: 1rem; margin-bottom: 8px; }
      a { color: #94a3b8; text-decoration: none; font-size: 0.88rem; &:hover { color: #fff; } }
    }
    .footer-desc { color: #94a3b8; font-size: 0.9rem; margin: 0 0 8px; }
    .footer-contact { color: #cbd5e1; font-size: 0.84rem; margin: 2px 0; }
    .footer-bottom {
      max-width: 1280px; margin: 40px auto 0; padding-top: 20px;
      border-top: 1px solid #1e293b; text-align: center; font-size: 0.82rem; color: #64748b;
    }
    @media (max-width: 900px) {
      .mobile-toggle { display: block; }
      .nav-links {
        display: none; position: absolute; top: 68px; left: 0; right: 0;
        background: #fff; flex-direction: column; padding: 16px 24px;
        border-bottom: 1px solid #e2e8f0; box-shadow: 0 10px 15px rgba(0,0,0,0.05);
        &.open { display: flex; }
      }
      .footer-inner { grid-template-columns: 1fr; }
    }
  `],
})
export class PublicLayoutComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly branding = signal<any>(null);
  readonly mobileMenuOpen = signal(false);

  ngOnInit() {
    this.api.get('settings/branding').subscribe({
      next: (data) => this.branding.set(data),
      error: () => {},
    });
  }
}
