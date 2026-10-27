import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

// ============================================================================
// 1. ADMIN DASHBOARD COMPONENT
// ============================================================================
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Executive Coaching Center Dashboard</h1>
          <p class="page-subtitle">Real-time academic operations, attendance health, and assessment analytics</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <a routerLink="/admin/students" class="btn btn-secondary btn-sm">+ Add Student</a>
          <a routerLink="/admin/teachers" class="btn btn-secondary btn-sm">+ Add Teacher</a>
          <a routerLink="/classes" class="btn btn-secondary btn-sm">+ Create Class</a>
          <a routerLink="/tests" class="btn btn-primary btn-sm">+ Create Test</a>
          <button class="btn btn-primary btn-sm" (click)="showAnnouncementModal.set(true)">📢 Send Announcement</button>
        </div>
      </div>

      @if (loading()) {
        <div class="kpi-grid">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="card"><div class="skeleton" style="height:64px"></div></div>
          }
        </div>
      } @else if (data()) {
        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Total Students</div>
              <div class="kpi-value">{{ data().kpis.totalStudents }}</div>
              <div class="kpi-sub">Active enrolled scholars</div>
            </div>
            <div class="kpi-icon"><span class="material-icons-outlined">school</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Faculty Members</div>
              <div class="kpi-value">{{ data().kpis.totalTeachers }}</div>
              <div class="kpi-sub">{{ data().kpis.activeCourses }} Active Courses</div>
            </div>
            <div class="kpi-icon" style="background:#ecfeff;color:#0891b2"><span class="material-icons-outlined">co_present</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Parents Linked</div>
              <div class="kpi-value">{{ data().kpis.totalParents }}</div>
              <div class="kpi-sub">Multi-child portal enabled</div>
            </div>
            <div class="kpi-icon" style="background:#f3e8ff;color:#7c3aed"><span class="material-icons-outlined">family_restroom</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Active Batches</div>
              <div class="kpi-value">{{ data().kpis.totalClasses }}</div>
              <div class="kpi-sub">{{ data().kpis.testsConducted }} Tests Published</div>
            </div>
            <div class="kpi-icon" style="background:#fffbeb;color:#d97706"><span class="material-icons-outlined">groups</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Avg Attendance</div>
              <div class="kpi-value">{{ data().kpis.overallAttendanceRate }}%</div>
              <div class="kpi-sub">Across last 7 sessions</div>
            </div>
            <div class="kpi-icon" style="background:#ecfdf5;color:#059669"><span class="material-icons-outlined">fact_check</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Avg Test Score</div>
              <div class="kpi-value">{{ data().kpis.averagePerformance }}%</div>
              <div class="kpi-sub">{{ data().kpis.totalQuestions }} Questions in Bank</div>
            </div>
            <div class="kpi-icon" style="background:#eef2ff;color:#4f46e5"><span class="material-icons-outlined">insights</span></div>
          </div>
        </div>

        <!-- Analytics Charts Row -->
        <div class="grid-2" style="margin-bottom:24px">
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
              <h3 style="margin:0">Class-Wise Performance & Participation</h3>
              <span class="badge badge-primary">Academic Year 2026–2027</span>
            </div>
            @for (cls of data().charts.classPerformance; track cls.id) {
              <div style="margin-bottom:14px">
                <div style="display:flex;justify-content:space-between;font-size:0.86rem;margin-bottom:6px">
                  <strong>{{ cls.name }} ({{ cls.studentsCount }} students)</strong>
                  <span style="font-weight:700;color:#4f46e5">{{ cls.averageScore }}% Avg</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" [style.width.%]="cls.averageScore"></div>
                </div>
              </div>
            }
          </div>

          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
              <h3 style="margin:0">Attendance Trends (Recent Sessions)</h3>
              <a routerLink="/attendance" class="btn btn-secondary btn-sm">View Full Attendance</a>
            </div>
            <div style="display:flex;align-items:flex-end;gap:12px;height:170px;padding-top:20px">
              @for (att of data().charts.attendanceTrends; track att.date + att.batch) {
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end">
                  <span style="font-size:0.72rem;font-weight:700;color:#059669;margin-bottom:4px">{{ att.percentage }}%</span>
                  <div
                    style="width:100%;max-width:38px;border-radius:6px 6px 0 0;background:linear-gradient(180deg,#059669,#10b981)"
                    [style.height.%]="att.percentage"
                    [title]="att.batch + ': ' + att.present + '/' + att.total"
                  ></div>
                  <span style="font-size:0.68rem;color:#64748b;margin-top:6px">{{ att.date.slice(5) }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Recent Activity, Announcements & New Registrations -->
        <div class="grid-3">
          <div class="card">
            <h3>📢 Active Announcements</h3>
            @for (a of data().announcements; track a.id) {
              <div style="padding:10px 0;border-bottom:1px solid #f1f5f9">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <strong style="font-size:0.88rem">{{ a.title }}</strong>
                  <span class="badge badge-warning">{{ a.targetScope }}</span>
                </div>
                <p style="margin:4px 0 0;font-size:0.8rem;color:#475569">{{ a.description }}</p>
              </div>
            }
          </div>

          <div class="card">
            <h3>🆕 Recent Registrations</h3>
            @for (u of data().newRegistrations; track u.id) {
              <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f1f5f9">
                <div>
                  <div style="font-weight:700;font-size:0.86rem">{{ u.firstName }} {{ u.lastName }}</div>
                  <div style="font-size:0.76rem;color:#64748b">{{ u.email }}</div>
                </div>
                <span class="badge badge-info">{{ u.role }}</span>
              </div>
            }
          </div>

          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <h3 style="margin:0">🛡️ Recent Audit Events</h3>
              <a routerLink="/admin/audit-logs" style="font-size:0.78rem;color:#4f46e5;font-weight:600">All Logs →</a>
            </div>
            @for (log of data().recentActivities.slice(0, 6); track log.id) {
              <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:0.8rem">
                <span class="badge badge-neutral">{{ log.action }}</span>
                <div style="color:#475569;margin-top:3px">
                  {{ log.userEmail || 'System' }} • {{ log.createdAt | date:'short' }}
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Announcement Modal -->
      @if (showAnnouncementModal()) {
        <div class="modal-backdrop">
          <div class="modal-box card">
            <h3>Publish New Announcement</h3>
            <div class="form-group">
              <label>Title <span class="req">*</span></label>
              <input type="text" [(ngModel)]="annForm.title" placeholder="e.g. Sunday CBT Mock Exam Schedule" />
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>Target Audience</label>
                <select [(ngModel)]="annForm.targetScope">
                  <option value="EVERYONE">Everyone</option>
                  <option value="STUDENTS">Students Only</option>
                  <option value="TEACHERS">Teachers Only</option>
                  <option value="PARENTS">Parents Only</option>
                </select>
              </div>
              <div class="form-group">
                <label>Priority</label>
                <select [(ngModel)]="annForm.priority">
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Description <span class="req">*</span></label>
              <textarea rows="3" [(ngModel)]="annForm.description" placeholder="Enter announcement message..."></textarea>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
              <button class="btn btn-secondary" (click)="showAnnouncementModal.set(false)">Cancel</button>
              <button class="btn btn-primary" (click)="publishAnnouncement()">Publish Announcement</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(15,23,42,0.55);
      display: flex; align-items: center; justify-content: center; z-index: 500; padding: 16px;
    }
    .modal-box { width: 100%; max-width: 520px; }
  `],
})
export class AdminDashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly data = signal<any>(null);
  readonly showAnnouncementModal = signal(false);

  annForm = {
    title: '',
    description: '',
    targetScope: 'EVERYONE',
    priority: 'HIGH',
  };

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.loading.set(true);
    this.api.get('reports/admin-dashboard').subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  publishAnnouncement() {
    if (!this.annForm.title || !this.annForm.description) return;
    this.api.post('announcements', this.annForm).subscribe(() => {
      this.toast.success('Announcement Published', 'Visible on targeted dashboards.');
      this.showAnnouncementModal.set(false);
      this.annForm = { title: '', description: '', targetScope: 'EVERYONE', priority: 'HIGH' };
      this.loadDashboard();
    });
  }
}

// ============================================================================
// 2. USER MANAGEMENT COMPONENT
// ============================================================================
@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">User & Access Management</h1>
          <p class="page-subtitle">Create, edit, filter, reset passwords, and manage account statuses across all roles</p>
        </div>
        <button class="btn btn-primary" (click)="showCreate.set(!showCreate())">
          {{ showCreate() ? 'Close Form' : '+ Create New User' }}
        </button>
      </div>

      @if (showCreate()) {
        <div class="card" style="margin-bottom:24px">
          <h3>Create User Account</h3>
          <form (ngSubmit)="createUser()">
            <div class="form-grid">
              <div class="form-group">
                <label>First Name <span class="req">*</span></label>
                <input type="text" [(ngModel)]="form.firstName" name="firstName" required />
              </div>
              <div class="form-group">
                <label>Last Name <span class="req">*</span></label>
                <input type="text" [(ngModel)]="form.lastName" name="lastName" required />
              </div>
              <div class="form-group">
                <label>Email <span class="req">*</span></label>
                <input type="email" [(ngModel)]="form.email" name="email" required />
              </div>
              <div class="form-group">
                <label>Role <span class="req">*</span></label>
                <select [(ngModel)]="form.role" name="role">
                  <option value="STUDENT">Student</option>
                  <option value="TEACHER">Teacher</option>
                  <option value="PARENT">Parent</option>
                  <option value="ADMIN">Admin / Center Manager</option>
                </select>
              </div>
              <div class="form-group">
                <label>Phone</label>
                <input type="text" [(ngModel)]="form.phone" name="phone" />
              </div>
              <div class="form-group">
                <label>Initial Password <span class="req">*</span></label>
                <input type="password" [(ngModel)]="form.password" name="password" required />
              </div>
            </div>
            <div style="display:flex;gap:10px">
              <button type="submit" class="btn btn-primary">Create Account</button>
              <button type="button" class="btn btn-secondary" (click)="showCreate.set(false)">Cancel</button>
            </div>
          </form>
        </div>
      }

      <!-- Filter Bar -->
      <div class="card" style="margin-bottom:20px;display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <input
          type="text"
          placeholder="Search name, email, username..."
          [(ngModel)]="search"
          (ngModelChange)="loadUsers()"
          style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;flex:1;min-width:220px"
        />
        <select [(ngModel)]="roleFilter" (ngModelChange)="loadUsers()" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px">
          <option value="">All Roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="ADMIN">Admin</option>
          <option value="TEACHER">Teacher</option>
          <option value="STUDENT">Student</option>
          <option value="PARENT">Parent</option>
        </select>
        <select [(ngModel)]="statusFilter" (ngModelChange)="loadUsers()" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px">
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <!-- Users Table -->
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Identifier / Code</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                <td>
                  <div style="font-weight:700">{{ u.firstName }} {{ u.lastName }}</div>
                  <div style="font-size:0.78rem;color:#64748b">{{ u.email }} • {{ u.phone || 'No phone' }}</div>
                </td>
                <td><span class="badge badge-primary">{{ u.role }}</span></td>
                <td>
                  {{ u.studentProfile?.studentCode || u.teacherProfile?.employeeCode || u.username }}
                </td>
                <td>
                  <span class="badge" [class.badge-success]="u.status === 'ACTIVE'" [class.badge-danger]="u.status !== 'ACTIVE'">
                    {{ u.status }}
                  </span>
                </td>
                <td>{{ u.lastLoginAt ? (u.lastLoginAt | date:'short') : 'Never' }}</td>
                <td>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button
                      class="btn btn-secondary btn-sm"
                      (click)="toggleStatus(u)"
                    >
                      {{ u.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}
                    </button>
                    <button class="btn btn-secondary btn-sm" (click)="resetUserPassword(u)">Reset Pwd</button>
                    <button class="btn btn-danger btn-sm" (click)="deleteUser(u)">Archive</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class UserManagementComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly users = signal<any[]>([]);
  readonly showCreate = signal(false);

  search = '';
  roleFilter = '';
  statusFilter = '';

  form = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'STUDENT',
    password: 'Welcome@123',
  };

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.api
      .get('users', {
        search: this.search,
        role: this.roleFilter,
        status: this.statusFilter,
        limit: 50,
      })
      .subscribe((res) => this.users.set(res.items || []));
  }

  createUser() {
    if (!this.form.firstName || !this.form.lastName || !this.form.email) return;
    this.api.post('users', this.form).subscribe(() => {
      this.toast.success('User Created', `Created ${this.form.firstName} (${this.form.role})`);
      this.showCreate.set(false);
      this.form = { firstName: '', lastName: '', email: '', phone: '', role: 'STUDENT', password: 'Welcome@123' };
      this.loadUsers();
    });
  }

  toggleStatus(u: any) {
    const next = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.api.patch(`users/${u.id}/status`, { status: next }).subscribe(() => {
      this.toast.info('Status Updated', `${u.firstName} is now ${next}`);
      this.loadUsers();
    });
  }

  resetUserPassword(u: any) {
    this.api.post(`users/${u.id}/reset-password`, { newPassword: 'Welcome@123' }).subscribe(() => {
      this.toast.success('Password Reset', `Password for ${u.email} reset to Welcome@123`);
    });
  }

  deleteUser(u: any) {
    this.toast.confirm({
      title: 'Archive User Account?',
      message: `Are you sure you want to deactivate and archive ${u.firstName} ${u.lastName}?`,
      confirmLabel: 'Yes, Archive',
      danger: true,
      onConfirm: () => {
        this.api.delete(`users/${u.id}`).subscribe(() => {
          this.toast.success('Archived', 'User account deactivated.');
          this.loadUsers();
        });
      },
    });
  }
}

// ============================================================================
// 3. STUDENT MANAGEMENT COMPONENT
// ============================================================================
@Component({
  selector: 'app-student-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Student Directory & Academic Profiles</h1>
          <p class="page-subtitle">Manage enrollments, batch allocations, parent links, and download progress report cards</p>
        </div>
        <button class="btn btn-primary" (click)="showAdd.set(!showAdd())">
          {{ showAdd() ? 'Close Form' : '+ Enroll New Student' }}
        </button>
      </div>

      @if (showAdd()) {
        <div class="card" style="margin-bottom:24px">
          <h3>New Student Admission (Auto-Generates Unique Student ID)</h3>
          <form (ngSubmit)="createStudent()">
            <div class="form-grid">
              <div class="form-group">
                <label>First Name <span class="req">*</span></label>
                <input type="text" [(ngModel)]="form.firstName" name="firstName" required />
              </div>
              <div class="form-group">
                <label>Last Name <span class="req">*</span></label>
                <input type="text" [(ngModel)]="form.lastName" name="lastName" required />
              </div>
              <div class="form-group">
                <label>Student Email <span class="req">*</span></label>
                <input type="email" [(ngModel)]="form.email" name="email" required />
              </div>
              <div class="form-group">
                <label>Grade / Class</label>
                <select [(ngModel)]="form.grade" name="grade">
                  <option value="Class 10">Class 10</option>
                  <option value="Class 11">Class 11</option>
                  <option value="Class 12">Class 12</option>
                </select>
              </div>
              <div class="form-group">
                <label>Assign Batch</label>
                <select [(ngModel)]="form.classBatchId" name="classBatchId">
                  <option value="">-- Select Batch --</option>
                  @for (c of classes(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Target Exam</label>
                <input type="text" [(ngModel)]="form.targetExam" name="targetExam" placeholder="e.g. JEE Advanced 2027" />
              </div>
            </div>
            <button type="submit" class="btn btn-primary">Confirm Admission</button>
          </form>
        </div>
      }

      <!-- Search & Batch Filter -->
      <div class="card" style="margin-bottom:20px;display:flex;gap:12px;flex-wrap:wrap">
        <input
          type="text"
          placeholder="Search by Student Code (EDU-2026-...), name, or email..."
          [(ngModel)]="search"
          (ngModelChange)="loadStudents()"
          style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px"
        />
        <select [(ngModel)]="batchFilter" (ngModelChange)="loadStudents()" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px">
          <option value="">All Batches</option>
          @for (c of classes(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
      </div>

      <!-- Student Table -->
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name & Email</th>
              <th>Grade & Target</th>
              <th>Batch</th>
              <th>Linked Parent</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (s of students(); track s.id) {
              <tr>
                <td><span class="badge badge-primary">{{ s.studentCode }}</span></td>
                <td>
                  <div style="font-weight:700">{{ s.user.firstName }} {{ s.user.lastName }}</div>
                  <div style="font-size:0.78rem;color:#64748b">{{ s.user.email }}</div>
                </td>
                <td>{{ s.grade }} • {{ s.targetExam }}</td>
                <td>{{ s.enrollments[0]?.classBatch?.name || 'Unassigned' }}</td>
                <td>
                  @if (s.parents?.length) {
                    {{ s.parents[0].parent.user.firstName }} {{ s.parents[0].parent.user.lastName }}
                  } @else {
                    <span style="color:#94a3b8">Not linked</span>
                  }
                </td>
                <td>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button class="btn btn-secondary btn-sm" (click)="inspectStudent(s.id)">View 360° Profile</button>
                    <button class="btn btn-primary btn-sm" (click)="downloadReportCard(s)">PDF Report Card</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- 360 Student Profile & Feedback Drawer/Card -->
      @if (selectedStudent()) {
        <div class="card" style="margin-top:24px;border:2px solid #4f46e5">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div>
              <h2 style="margin:0">{{ selectedStudent().user.firstName }} {{ selectedStudent().user.lastName }} ({{ selectedStudent().studentCode }})</h2>
              <p style="margin:4px 0 0;color:#64748b">
                Attendance: <strong>{{ selectedStudent().summary.attendancePercentage }}%</strong> |
                Avg Test Score: <strong>{{ selectedStudent().summary.averagePercentage }}%</strong> |
                Best Score: <strong>{{ selectedStudent().summary.bestPercentage }}%</strong>
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" (click)="selectedStudent.set(null)">Close ✕</button>
          </div>

          <div class="grid-2">
            <div>
              <h4>Recent Test Scores</h4>
              @for (r of selectedStudent().results; track r.id) {
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:0.86rem">
                  <span>{{ r.test.title }} ({{ r.subject.name }})</span>
                  <strong>{{ r.obtainedMarks }}/{{ r.totalMarks }} ({{ r.percentage }}%)</strong>
                </div>
              } @empty {
                <p style="color:#64748b;font-size:0.86rem">No test attempts recorded yet.</p>
              }
            </div>

            <div>
              <h4>Add Faculty Feedback</h4>
              <div class="form-grid">
                <div class="form-group">
                  <label>Category</label>
                  <select [(ngModel)]="feedbackForm.category">
                    <option value="ACADEMIC">Academic</option>
                    <option value="ATTENDANCE">Attendance</option>
                    <option value="HOMEWORK">Homework</option>
                    <option value="BEHAVIOUR">Behaviour</option>
                    <option value="IMPROVEMENT">Improvement</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Rating (1-5)</label>
                  <input type="number" min="1" max="5" [(ngModel)]="feedbackForm.rating" />
                </div>
              </div>
              <div class="form-group">
                <label>Feedback Comment</label>
                <input type="text" [(ngModel)]="feedbackForm.comment" placeholder="Constructive academic remark..." />
              </div>
              <button class="btn btn-primary btn-sm" (click)="submitFeedback(selectedStudent().id)">Save Feedback</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class StudentManagementComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly students = signal<any[]>([]);
  readonly classes = signal<any[]>([]);
  readonly showAdd = signal(false);
  readonly selectedStudent = signal<any>(null);

  search = '';
  batchFilter = '';

  form = {
    firstName: '',
    lastName: '',
    email: '',
    grade: 'Class 12',
    classBatchId: '',
    targetExam: 'JEE Advanced 2027',
  };

  feedbackForm = {
    category: 'ACADEMIC',
    rating: 5,
    comment: '',
  };

  ngOnInit() {
    this.loadStudents();
    this.api.get('classes').subscribe((res) => this.classes.set(res || []));
  }

  loadStudents() {
    this.api
      .get('students', { search: this.search, classBatchId: this.batchFilter, limit: 50 })
      .subscribe((res) => this.students.set(res.items || []));
  }

  createStudent() {
    if (!this.form.firstName || !this.form.lastName || !this.form.email) return;
    this.api.post('students', this.form).subscribe((created) => {
      this.toast.success('Student Enrolled', `Generated ID: ${created.studentProfile?.studentCode || 'Success'}`);
      this.showAdd.set(false);
      this.form = { firstName: '', lastName: '', email: '', grade: 'Class 12', classBatchId: '', targetExam: 'JEE Advanced 2027' };
      this.loadStudents();
    });
  }

  inspectStudent(id: string) {
    this.api.get(`students/${id}`).subscribe((res) => this.selectedStudent.set(res));
  }

  downloadReportCard(s: any) {
    this.api.downloadFile(`pdf/progress-report/${s.id}`, `Progress-Report-${s.studentCode}.pdf`);
  }

  submitFeedback(studentId: string) {
    if (!this.feedbackForm.comment) return;
    this.api.post('feedback', { ...this.feedbackForm, studentId }).subscribe(() => {
      this.toast.success('Feedback Saved', 'Visible on Student and Parent portals.');
      this.feedbackForm.comment = '';
      this.inspectStudent(studentId);
    });
  }
}

// ============================================================================
// 4. TEACHER MANAGEMENT COMPONENT
// ============================================================================
@Component({
  selector: 'app-teacher-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Faculty & Teacher Management</h1>
          <p class="page-subtitle">Onboard faculty members and assign classes, batches, and subjects</p>
        </div>
        <button class="btn btn-primary" (click)="showAdd.set(!showAdd())">
          {{ showAdd() ? 'Close' : '+ Add Faculty Member' }}
        </button>
      </div>

      @if (showAdd()) {
        <div class="card" style="margin-bottom:24px">
          <h3>Onboard New Faculty</h3>
          <form (ngSubmit)="createTeacher()">
            <div class="form-grid">
              <div class="form-group">
                <label>First Name <span class="req">*</span></label>
                <input type="text" [(ngModel)]="form.firstName" name="firstName" required />
              </div>
              <div class="form-group">
                <label>Last Name <span class="req">*</span></label>
                <input type="text" [(ngModel)]="form.lastName" name="lastName" required />
              </div>
              <div class="form-group">
                <label>Email <span class="req">*</span></label>
                <input type="email" [(ngModel)]="form.email" name="email" required />
              </div>
              <div class="form-group">
                <label>Qualification</label>
                <input type="text" [(ngModel)]="form.qualification" name="qualification" placeholder="e.g. Ph.D. Physics (IIT)" />
              </div>
              <div class="form-group">
                <label>Specialization</label>
                <input type="text" [(ngModel)]="form.specialization" name="specialization" placeholder="e.g. Electrodynamics" />
              </div>
              <div class="form-group">
                <label>Experience (Years)</label>
                <input type="number" [(ngModel)]="form.experienceYears" name="experienceYears" />
              </div>
            </div>
            <button type="submit" class="btn btn-primary">Create Teacher Account</button>
          </form>
        </div>
      }

      <div class="grid-3">
        @for (t of teachers(); track t.id) {
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <span class="badge badge-primary">{{ t.employeeCode }}</span>
              <span class="badge badge-success">{{ t.experienceYears }} Yrs Exp</span>
            </div>
            <h3 style="margin:0 0 4px">{{ t.user.firstName }} {{ t.user.lastName }}</h3>
            <div style="font-size:0.82rem;color:#4f46e5;font-weight:600">{{ t.qualification }}</div>
            <p style="font-size:0.85rem;color:#475569;margin:8px 0">{{ t.specialization }}</p>
            <div style="font-size:0.8rem;color:#334155;margin-top:10px">
              <strong>Assigned Batches:</strong>
              @for (ca of t.classAssignments; track ca.id) {
                <span class="badge badge-neutral" style="margin:3px">{{ ca.classBatch.name }} ({{ ca.subject.name }})</span>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class TeacherManagementComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly teachers = signal<any[]>([]);
  readonly showAdd = signal(false);

  form = {
    firstName: '',
    lastName: '',
    email: '',
    qualification: 'M.Tech / Ph.D.',
    specialization: 'Physics & Mathematics',
    experienceYears: 8,
  };

  ngOnInit() {
    this.loadTeachers();
  }

  loadTeachers() {
    this.api.get('teachers').subscribe((res) => this.teachers.set(res.items || []));
  }

  createTeacher() {
    if (!this.form.firstName || !this.form.email) return;
    this.api.post('teachers', this.form).subscribe(() => {
      this.toast.success('Teacher Onboarded', 'Faculty account created.');
      this.showAdd.set(false);
      this.loadTeachers();
    });
  }
}

// ============================================================================
// 5. ADMIN REPORTS, SETTINGS & AUDIT LOGS COMPONENTS
// ============================================================================
@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Enterprise Reports & Branded Exports</h1>
          <p class="page-subtitle">Export institutional data to CSV/Excel or generate official Branded PDF Reports</p>
        </div>
      </div>

      <div class="grid-3">
        <div class="card">
          <span class="material-icons-outlined" style="font-size:36px;color:#4f46e5">school</span>
          <h3>Student Enrollment & Performance Report</h3>
          <p style="color:#475569;font-size:0.88rem">Complete roster of enrolled students, batch allocations, target exams, and account statuses.</p>
          <button class="btn btn-primary btn-sm" (click)="exportCsv('students')">Download CSV / Excel</button>
        </div>

        <div class="card">
          <span class="material-icons-outlined" style="font-size:36px;color:#059669">fact_check</span>
          <h3>Attendance Summary & Daily Logs</h3>
          <p style="color:#475569;font-size:0.88rem">Export batch-wise and student-wise attendance logs in CSV or official Branded PDF format.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" (click)="exportCsv('attendance')">Export CSV</button>
            <button class="btn btn-primary btn-sm" (click)="exportAttendancePdf()">Branded PDF Report</button>
          </div>
        </div>

        <div class="card">
          <span class="material-icons-outlined" style="font-size:36px;color:#0891b2">insights</span>
          <h3>Assessment & Test Results Report</h3>
          <p style="color:#475569;font-size:0.88rem">Complete test scores, accuracy percentages, ranks, and pass/fail analytics across all batches.</p>
          <button class="btn btn-primary btn-sm" (click)="exportCsv('results')">Download Results CSV</button>
        </div>
      </div>
    </div>
  `,
})
export class AdminReportsComponent {
  private readonly api = inject(ApiService);

  exportCsv(type: string) {
    this.api.downloadFile('reports/export/csv', `edunexus-${type}-report.csv`, { type });
  }

  exportAttendancePdf() {
    this.api.downloadFile('pdf/attendance-report', 'EduNexus-Attendance-Report.pdf');
  }
}

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container" style="max-width:980px">
      <div class="page-header">
        <div>
          <h1 class="page-title">Coaching Center Branding & System Settings</h1>
          <p class="page-subtitle">Changes here dynamically update the Public Website, Report Cards, and Branded PDF Test Papers</p>
        </div>
      </div>

      <div class="card">
        <h3>Institution Branding & Contact Configuration</h3>
        <form (ngSubmit)="saveBranding()">
          <div class="form-grid">
            <div class="form-group">
              <label>Coaching Center Name <span class="req">*</span></label>
              <input type="text" [(ngModel)]="branding.centerName" name="centerName" required />
            </div>
            <div class="form-group">
              <label>Logo Monogram (2-3 chars)</label>
              <input type="text" [(ngModel)]="branding.logoText" name="logoText" />
            </div>
            <div class="form-group">
              <label>Tagline</label>
              <input type="text" [(ngModel)]="branding.tagline" name="tagline" />
            </div>
            <div class="form-group">
              <label>Primary Brand Color (Hex)</label>
              <input type="text" [(ngModel)]="branding.primaryColor" name="primaryColor" />
            </div>
            <div class="form-group">
              <label>Contact Phone</label>
              <input type="text" [(ngModel)]="branding.phone" name="phone" />
            </div>
            <div class="form-group">
              <label>Official Email</label>
              <input type="email" [(ngModel)]="branding.email" name="email" />
            </div>
          </div>
          <div class="form-group">
            <label>Campus Address (Printed on PDF Test Headers)</label>
            <input type="text" [(ngModel)]="branding.address" name="address" />
          </div>
          <div class="form-group">
            <label>PDF & Website Footer Text</label>
            <input type="text" [(ngModel)]="branding.footerText" name="footerText" />
          </div>
          <button type="submit" class="btn btn-primary">Save Branding Configuration</button>
        </form>
      </div>
    </div>
  `,
})
export class AdminSettingsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  branding: any = {
    centerName: '',
    logoText: 'EN',
    tagline: '',
    primaryColor: '#4f46e5',
    phone: '',
    email: '',
    address: '',
    footerText: '',
  };

  ngOnInit() {
    this.api.get('settings/branding').subscribe((res) => {
      if (res) this.branding = { ...this.branding, ...res };
    });
  }

  saveBranding() {
    this.api
      .put('settings', {
        key: 'CENTER_BRANDING',
        category: 'BRANDING',
        value: this.branding,
      })
      .subscribe(() => {
        this.toast.success('Branding Updated', 'Applied to Public Website and PDF Generator.');
      });
  }
}

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Security & Administrative Audit Logs</h1>
          <p class="page-subtitle">Immutable trail of logins, role changes, test publications, and attendance modifications</p>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Role</th>
              <th>Entity</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            @for (log of logs(); track log.id) {
              <tr>
                <td>{{ log.createdAt | date:'medium' }}</td>
                <td><span class="badge badge-primary">{{ log.action }}</span></td>
                <td>{{ log.userEmail || 'System' }}</td>
                <td>{{ log.userRole || '-' }}</td>
                <td>{{ log.entity }} ({{ log.entityId || '-' }})</td>
                <td>{{ log.ipAddress }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AuditLogsComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly logs = signal<any[]>([]);

  ngOnInit() {
    this.api.get('audit-logs', { limit: 50 }).subscribe((res) => this.logs.set(res.items || []));
  }
}
