import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/services/auth.service';
import { ApiService } from '../core/services/api.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="dashboard-shell">
      <!-- Mobile Overlay -->
      @if (sidebarOpen()) {
        <div class="sidebar-backdrop" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- Sidebar Navigation -->
      <aside class="sidebar" [class.open]="sidebarOpen()">
        <div class="sidebar-brand">
          <div class="logo-badge">EN</div>
          <div>
            <div class="brand-title">EduNexus</div>
            <div class="role-pill">{{ auth.userRole() }} PORTAL</div>
          </div>
        </div>

        <nav class="sidebar-nav" aria-label="Main Portal Navigation">
          @for (item of navItems(); track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="active"
              class="nav-item"
              (click)="sidebarOpen.set(false)"
            >
              <span class="material-icons-outlined">{{ item.icon }}</span>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <a routerLink="/" class="nav-item muted-link">
            <span class="material-icons-outlined">public</span>
            <span>Public Website</span>
          </a>
          <button class="nav-item logout-btn" (click)="auth.logout()">
            <span class="material-icons-outlined">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <!-- Main Content Area -->
      <div class="main-wrapper">
        <!-- Top Header -->
        <header class="topbar">
          <div class="topbar-left">
            <button class="icon-btn mobile-menu-btn" (click)="sidebarOpen.set(!sidebarOpen())" aria-label="Toggle Menu">
              <span class="material-icons-outlined">menu</span>
            </button>

            <!-- Global Debounced Search -->
            <div class="global-search">
              <span class="material-icons-outlined search-icon">search</span>
              <input
                type="text"
                placeholder="Search students, tests, classes, questions..."
                [(ngModel)]="searchQuery"
                (ngModelChange)="onSearchChange($event)"
                aria-label="Global Search"
              />
              @if (searchResultsOpen() && searchResults()) {
                <div class="search-dropdown">
                  <div class="search-dropdown-header">
                    <span>Search Results</span>
                    <button class="close-mini" (click)="searchResultsOpen.set(false)">✕</button>
                  </div>
                  @if (searchResults().tests?.length) {
                    <div class="search-group-title">Tests</div>
                    @for (t of searchResults().tests; track t.id) {
                      <a class="search-hit" [routerLink]="auth.userRole() === 'STUDENT' ? '/student/tests' : '/tests'" (click)="searchResultsOpen.set(false)">
                        <strong>{{ t.title }}</strong> <span class="badge badge-primary">{{ t.code }}</span>
                      </a>
                    }
                  }
                  @if (searchResults().classes?.length) {
                    <div class="search-group-title">Classes & Batches</div>
                    @for (c of searchResults().classes; track c.id) {
                      <a class="search-hit" routerLink="/classes" (click)="searchResultsOpen.set(false)">
                        <strong>{{ c.name }}</strong> <span class="badge badge-neutral">{{ c.code }}</span>
                      </a>
                    }
                  }
                  @if (searchResults().students?.length) {
                    <div class="search-group-title">Students</div>
                    @for (s of searchResults().students; track s.id) {
                      <a class="search-hit" routerLink="/admin/students" (click)="searchResultsOpen.set(false)">
                        <strong>{{ s.user.firstName }} {{ s.user.lastName }}</strong> ({{ s.studentCode }})
                      </a>
                    }
                  }
                  @if (!searchResults().tests?.length && !searchResults().classes?.length && !searchResults().students?.length) {
                    <div class="search-empty">No matching records found for "{{ searchQuery }}"</div>
                  }
                </div>
              }
            </div>
          </div>

          <div class="topbar-right">
            <!-- Parent Child Switcher -->
            @if (auth.userRole() === 'PARENT' && parentChildren().length > 0) {
              <div class="child-switcher">
                <span class="material-icons-outlined" style="font-size:18px;color:#4f46e5">Escalator_warning</span>
                <select
                  [ngModel]="auth.selectedChildId()"
                  (ngModelChange)="onSwitchChild($event)"
                  aria-label="Switch Active Child"
                >
                  @for (child of parentChildren(); track child.student.id) {
                    <option [value]="child.student.id">
                      Child: {{ child.student.user.firstName }} {{ child.student.user.lastName }} ({{ child.student.grade }})
                    </option>
                  }
                </select>
              </div>
            }

            <!-- Notifications Bell -->
            <div class="notif-wrapper">
              <button class="icon-btn" (click)="toggleNotifications()" aria-label="Notifications">
                <span class="material-icons-outlined">notifications</span>
                @if (unreadCount() > 0) {
                  <span class="notif-badge">{{ unreadCount() }}</span>
                }
              </button>

              @if (notifOpen()) {
                <div class="notif-dropdown">
                  <div class="notif-header">
                    <strong>Notifications ({{ unreadCount() }} unread)</strong>
                    <button class="text-btn" (click)="markAllNotificationsRead()">Mark all read</button>
                  </div>
                  <div class="notif-list">
                    @for (n of notifications(); track n.id) {
                      <div class="notif-item" [class.unread]="!n.isRead" (click)="openNotification(n)">
                        <div class="notif-title">{{ n.title }}</div>
                        <div class="notif-msg">{{ n.message }}</div>
                        <div class="notif-time">{{ n.createdAt | date:'short' }}</div>
                      </div>
                    } @empty {
                      <div class="notif-empty">You're all caught up!</div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- User Profile Chip -->
            <a routerLink="/profile" class="user-chip" title="View & Edit Profile">
              <div class="avatar-circle">
                {{ auth.currentUser()?.firstName?.charAt(0) }}{{ auth.currentUser()?.lastName?.charAt(0) }}
              </div>
              <div class="user-meta">
                <span class="user-name">{{ auth.currentUser()?.firstName }} {{ auth.currentUser()?.lastName }}</span>
                <span class="user-role">{{ auth.userRole() }}</span>
              </div>
            </a>
          </div>
        </header>

        <!-- Router Content -->
        <main class="content-area">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-shell { display: flex; min-height: 100vh; background: #f8fafc; }
    .sidebar {
      width: 260px; background: #0f172a; color: #f8fafc;
      display: flex; flex-direction: column; flex-shrink: 0;
      position: sticky; top: 0; height: 100vh; overflow-y: auto;
      z-index: 200; transition: transform 0.25s ease;
    }
    .sidebar-brand {
      padding: 20px; display: flex; align-items: center; gap: 12px;
      border-bottom: 1px solid #1e293b;
    }
    .logo-badge {
      width: 38px; height: 38px; border-radius: 10px;
      background: linear-gradient(135deg, #4f46e5, #06b6d4);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; color: #fff;
    }
    .brand-title { font-weight: 800; font-size: 1.1rem; letter-spacing: -0.02em; }
    .role-pill {
      font-size: 0.68rem; font-weight: 700; color: #38bdf8;
      letter-spacing: 0.06em; margin-top: 2px;
    }
    .sidebar-nav {
      flex: 1; padding: 14px 12px; display: flex; flex-direction: column; gap: 4px;
    }
    .nav-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px; border-radius: 10px;
      color: #94a3b8; text-decoration: none; font-size: 0.88rem; font-weight: 600;
      transition: all 0.15s ease; border: none; background: transparent; width: 100%; cursor: pointer; text-align: left;
      &:hover { background: #1e293b; color: #fff; }
      &.active { background: #4f46e5; color: #fff; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35); }
    }
    .sidebar-footer { padding: 12px; border-top: 1px solid #1e293b; display: flex; flex-direction: column; gap: 4px; }
    .logout-btn { color: #fca5a5; &:hover { background: rgba(239, 68, 68, 0.15); color: #fecaca; } }

    .main-wrapper { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .topbar {
      height: 64px; background: #ffffff; border-bottom: 1px solid #e2e8f0;
      padding: 0 24px; display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 90; gap: 16px;
    }
    .topbar-left { display: flex; align-items: center; gap: 12px; flex: 1; max-width: 520px; }
    .mobile-menu-btn { display: none; }
    .global-search {
      position: relative; width: 100%;
      .search-icon { position: absolute; left: 12px; top: 9px; color: #94a3b8; font-size: 20px; }
      input {
        width: 100%; padding: 8px 14px 8px 40px; border-radius: 999px;
        border: 1px solid #cbd5e1; background: #f8fafc; font-size: 0.86rem;
        &:focus { background: #fff; border-color: #4f46e5; outline: none; }
      }
    }
    .search-dropdown {
      position: absolute; top: 44px; left: 0; right: 0;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12); padding: 12px; z-index: 300;
    }
    .search-dropdown-header { display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700; color: #64748b; margin-bottom: 8px; }
    .close-mini { background: none; border: none; cursor: pointer; color: #64748b; }
    .search-group-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin: 8px 0 4px; }
    .search-hit {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 10px; border-radius: 8px; text-decoration: none; color: #0f172a; font-size: 0.85rem;
      &:hover { background: #f1f5f9; }
    }
    .search-empty { padding: 12px; text-align: center; font-size: 0.84rem; color: #64748b; }

    .topbar-right { display: flex; align-items: center; gap: 14px; }
    .child-switcher {
      display: flex; align-items: center; gap: 6px;
      background: #eef2ff; padding: 5px 12px; border-radius: 999px; border: 1px solid #c7d2fe;
      select { border: none; background: transparent; font-weight: 600; font-size: 0.82rem; color: #312e81; cursor: pointer; outline: none; }
    }
    .icon-btn {
      position: relative; width: 38px; height: 38px; border-radius: 10px;
      border: 1px solid #e2e8f0; background: #fff; cursor: pointer;
      display: flex; align-items: center; justify-content: center; color: #334155;
      &:hover { background: #f8fafc; }
    }
    .notif-badge {
      position: absolute; top: -4px; right: -4px;
      background: #dc2626; color: #fff; font-size: 0.68rem; font-weight: 700;
      padding: 1px 5px; border-radius: 999px;
    }
    .notif-wrapper { position: relative; }
    .notif-dropdown {
      position: absolute; right: 0; top: 46px; width: 340px;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.14); z-index: 300; overflow: hidden;
    }
    .notif-header {
      padding: 12px 16px; border-bottom: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center; font-size: 0.86rem;
    }
    .text-btn { background: none; border: none; color: #4f46e5; font-weight: 600; font-size: 0.78rem; cursor: pointer; }
    .notif-list { max-height: 340px; overflow-y: auto; }
    .notif-item {
      padding: 12px 16px; border-bottom: 1px solid #f1f5f9; cursor: pointer;
      &.unread { background: #eef2ff; }
      &:hover { background: #f8fafc; }
      .notif-title { font-weight: 700; font-size: 0.84rem; color: #0f172a; }
      .notif-msg { font-size: 0.8rem; color: #475569; margin-top: 2px; }
      .notif-time { font-size: 0.72rem; color: #94a3b8; margin-top: 4px; }
    }
    .notif-empty { padding: 24px; text-align: center; color: #64748b; font-size: 0.85rem; }

    .user-chip {
      display: flex; align-items: center; gap: 10px; text-decoration: none;
      padding: 4px 10px 4px 4px; border-radius: 999px; border: 1px solid #e2e8f0;
      &:hover { background: #f8fafc; }
    }
    .avatar-circle {
      width: 32px; height: 32px; border-radius: 50%;
      background: #4f46e5; color: #fff; font-weight: 700; font-size: 0.8rem;
      display: flex; align-items: center; justify-content: center;
    }
    .user-meta { display: flex; flex-direction: column; line-height: 1.15; }
    .user-name { font-size: 0.82rem; font-weight: 700; color: #0f172a; }
    .user-role { font-size: 0.68rem; color: #64748b; font-weight: 600; }
    .content-area { flex: 1; }
    .sidebar-backdrop { display: none; }

    @media (max-width: 992px) {
      .mobile-menu-btn { display: flex; }
      .sidebar {
        position: fixed; left: 0; top: 0; bottom: 0;
        transform: translateX(-100%);
        &.open { transform: translateX(0); }
      }
      .sidebar-backdrop {
        display: block; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); z-index: 150;
      }
      .user-meta { display: none; }
    }
  `],
})
export class DashboardLayoutComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly sidebarOpen = signal(false);
  readonly notifOpen = signal(false);
  readonly notifications = signal<any[]>([]);
  readonly unreadCount = signal(0);

  searchQuery = '';
  private searchTimer: any;
  readonly searchResultsOpen = signal(false);
  readonly searchResults = signal<any>(null);

  readonly parentChildren = computed(() => {
    return this.auth.currentUser()?.parentProfile?.children || [];
  });

  readonly navItems = computed<NavItem[]>(() => {
    const role = this.auth.userRole();
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return [
        { label: 'Admin Dashboard', icon: 'space_dashboard', route: '/admin/dashboard' },
        { label: 'User Management', icon: 'manage_accounts', route: '/admin/users' },
        { label: 'Students', icon: 'school', route: '/admin/students' },
        { label: 'Teachers & Faculty', icon: 'co_present', route: '/admin/teachers' },
        { label: 'Classes & Batches', icon: 'groups', route: '/classes' },
        { label: 'Question Bank', icon: 'quiz', route: '/questions' },
        { label: 'Tests & Assessments', icon: 'assignment', route: '/tests' },
        { label: 'Attendance', icon: 'fact_check', route: '/attendance' },
        { label: 'Study Materials', icon: 'menu_book', route: '/materials' },
        { label: 'Assignments', icon: 'task', route: '/assignments' },
        { label: 'Messages', icon: 'forum', route: '/messages' },
        { label: 'Reports & Analytics', icon: 'analytics', route: '/admin/reports' },
        { label: 'Branding & Settings', icon: 'settings', route: '/admin/settings' },
        { label: 'Audit Logs', icon: 'policy', route: '/admin/audit-logs' },
      ];
    }
    if (role === 'TEACHER') {
      return [
        { label: 'Teacher Dashboard', icon: 'space_dashboard', route: '/teacher/dashboard' },
        { label: 'Classes & Timetable', icon: 'groups', route: '/classes' },
        { label: 'Question Bank', icon: 'quiz', route: '/questions' },
        { label: 'Tests & Creation', icon: 'assignment', route: '/tests' },
        { label: 'Attendance Marker', icon: 'fact_check', route: '/attendance' },
        { label: 'Students & Feedback', icon: 'school', route: '/admin/students' },
        { label: 'Study Materials', icon: 'menu_book', route: '/materials' },
        { label: 'Homework / DPP', icon: 'task', route: '/assignments' },
        { label: 'Messages', icon: 'forum', route: '/messages' },
      ];
    }
    if (role === 'STUDENT') {
      return [
        { label: 'My Dashboard', icon: 'space_dashboard', route: '/student/dashboard' },
        { label: 'Assigned Tests', icon: 'assignment', route: '/student/tests' },
        { label: 'Results & Analytics', icon: 'insights', route: '/student/results' },
        { label: 'My Attendance', icon: 'event_available', route: '/attendance' },
        { label: 'Study Materials', icon: 'menu_book', route: '/materials' },
        { label: 'Homework / DPP', icon: 'task', route: '/assignments' },
        { label: 'Messages & Doubts', icon: 'forum', route: '/messages' },
      ];
    }
    if (role === 'PARENT') {
      return [
        { label: 'Parent Dashboard', icon: 'family_restroom', route: '/parent/dashboard' },
        { label: 'Child Attendance', icon: 'event_available', route: '/attendance' },
        { label: 'Study Materials', icon: 'menu_book', route: '/materials' },
        { label: 'Homework Status', icon: 'task', route: '/assignments' },
        { label: 'Message Teachers', icon: 'forum', route: '/messages' },
      ];
    }
    return [];
  });

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.api.get('notifications').subscribe({
      next: (res) => {
        this.notifications.set(res.items || []);
        this.unreadCount.set(res.unreadCount || 0);
      },
      error: () => {},
    });
  }

  toggleNotifications() {
    this.notifOpen.set(!this.notifOpen());
    if (this.notifOpen()) {
      this.loadNotifications();
    }
  }

  markAllNotificationsRead() {
    this.api.patch('notifications/read-all').subscribe(() => {
      this.loadNotifications();
    });
  }

  openNotification(n: any) {
    this.api.patch(`notifications/${n.id}/read`).subscribe(() => {
      this.loadNotifications();
    });
    this.notifOpen.set(false);
    if (n.link) {
      this.router.navigateByUrl(n.link);
    }
  }

  onSwitchChild(studentId: string) {
    this.auth.selectedChildId.set(studentId);
  }

  onSearchChange(val: string) {
    clearTimeout(this.searchTimer);
    if (!val || val.trim().length < 2) {
      this.searchResultsOpen.set(false);
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.api.get('search', { q: val.trim() }).subscribe({
        next: (res) => {
          this.searchResults.set(res);
          this.searchResultsOpen.set(true);
        },
      });
    }, 300);
  }
}
