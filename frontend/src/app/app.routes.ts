import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layout/public-layout.component';
import { DashboardLayoutComponent } from './layout/dashboard-layout.component';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import {
  HomeComponent,
  AboutComponent,
  CoursesPageComponent,
  FacultyPageComponent,
  FaqPageComponent,
  ContactPageComponent,
} from './features/public/public-pages.component';
import { LoginComponent, ProfileComponent } from './features/auth/auth-pages.component';
import {
  AdminDashboardComponent,
  UserManagementComponent,
  StudentManagementComponent,
  TeacherManagementComponent,
  AdminReportsComponent,
  AdminSettingsComponent,
  AuditLogsComponent,
} from './features/admin/admin-pages.component';
import {
  TeacherDashboardComponent,
  StudentDashboardComponent,
  StudentTestsListComponent,
  StudentExamInterfaceComponent,
  StudentResultsComponent,
  ParentDashboardComponent,
} from './features/portals/role-portals.component';
import {
  QuestionBankComponent,
  TestManagementComponent,
  ClassesAndTimetableComponent,
  AttendanceManagementComponent,
  StudyMaterialsComponent,
  AssignmentsPageComponent,
  MessagingPageComponent,
} from './features/operations/operations-pages.component';

export const routes: Routes = [
  // 1. Public Marketing Website Routes
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', component: HomeComponent },
      { path: 'about', component: AboutComponent },
      { path: 'courses', component: CoursesPageComponent },
      { path: 'faculty', component: FacultyPageComponent },
      { path: 'faq', component: FaqPageComponent },
      { path: 'contact', component: ContactPageComponent },
      { path: 'login', component: LoginComponent },
    ],
  },

  // 2. Authenticated Role-Based Portal Routes
  {
    path: '',
    component: DashboardLayoutComponent,
    canActivate: [authGuard],
    children: [
      // Admin Portal Routes
      {
        path: 'admin/dashboard',
        component: AdminDashboardComponent,
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN'])],
      },
      {
        path: 'admin/users',
        component: UserManagementComponent,
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN'])],
      },
      {
        path: 'admin/students',
        component: StudentManagementComponent,
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN', 'TEACHER'])],
      },
      {
        path: 'admin/teachers',
        component: TeacherManagementComponent,
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN'])],
      },
      {
        path: 'admin/reports',
        component: AdminReportsComponent,
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN'])],
      },
      {
        path: 'admin/settings',
        component: AdminSettingsComponent,
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN'])],
      },
      {
        path: 'admin/audit-logs',
        component: AuditLogsComponent,
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN'])],
      },

      // Teacher Portal Routes
      {
        path: 'teacher/dashboard',
        component: TeacherDashboardComponent,
        canActivate: [roleGuard(['TEACHER', 'ADMIN', 'SUPER_ADMIN'])],
      },

      // Student Portal Routes
      {
        path: 'student/dashboard',
        component: StudentDashboardComponent,
        canActivate: [roleGuard(['STUDENT'])],
      },
      {
        path: 'student/tests',
        component: StudentTestsListComponent,
        canActivate: [roleGuard(['STUDENT'])],
      },
      {
        path: 'student/exam/:id',
        component: StudentExamInterfaceComponent,
        canActivate: [roleGuard(['STUDENT'])],
      },
      {
        path: 'student/results',
        component: StudentResultsComponent,
        canActivate: [roleGuard(['STUDENT'])],
      },

      // Parent Portal Routes
      {
        path: 'parent/dashboard',
        component: ParentDashboardComponent,
        canActivate: [roleGuard(['PARENT'])],
      },

      // Shared Operational Routes (RBAC enforced in guards & API)
      {
        path: 'questions',
        component: QuestionBankComponent,
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN', 'TEACHER'])],
      },
      {
        path: 'tests',
        component: TestManagementComponent,
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN', 'TEACHER'])],
      },
      {
        path: 'classes',
        component: ClassesAndTimetableComponent,
      },
      {
        path: 'attendance',
        component: AttendanceManagementComponent,
      },
      {
        path: 'materials',
        component: StudyMaterialsComponent,
      },
      {
        path: 'assignments',
        component: AssignmentsPageComponent,
      },
      {
        path: 'messages',
        component: MessagingPageComponent,
      },
      {
        path: 'profile',
        component: ProfileComponent,
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
