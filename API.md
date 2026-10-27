# REST API Reference — EduNexus Platform

Base URL: `http://localhost:3000/api`
Interactive OpenAPI / Swagger UI: `http://localhost:3000/api/docs`

---

## 1. Authentication (`/api/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Login with `identifier` (email, username, or phone) & `password`. Returns `accessToken`, `refreshToken`, `redirectUrl`, and `user`. |
| `POST` | `/api/auth/refresh` | Public | Rotate refresh token and issue a new access token. |
| `POST` | `/api/auth/logout` | Authenticated | Revoke active refresh token(s). |
| `POST` | `/api/auth/forgot-password` | Public | Generate single-use password reset token and send reset email. |
| `POST` | `/api/auth/reset-password` | Public | Reset password using valid token and enforce password strength. |
| `POST` | `/api/auth/change-password` | Authenticated | Change current user password. |
| `GET` | `/api/auth/me` | Authenticated | Get full profile and role context of current user. |
| `PATCH` | `/api/auth/profile` | Authenticated | Update personal profile information. |

---

## 2. Users, Students, Teachers & Parents

| Method | Endpoint | Roles Allowed | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | `SUPER_ADMIN`, `ADMIN` | Paginated user list (`?page=1&limit=20&role=STUDENT&status=ACTIVE&search=...`). |
| `POST` | `/api/users` | `SUPER_ADMIN`, `ADMIN` | Create user and initialize role profile. |
| `PATCH` | `/api/users/:id/status` | `SUPER_ADMIN`, `ADMIN` | Activate or deactivate user account. |
| `POST` | `/api/users/:id/reset-password` | `SUPER_ADMIN`, `ADMIN` | Admin password reset. |
| `GET` | `/api/students` | `ADMIN`, `TEACHER`, `PARENT` | Paginated student list (`?page=1&limit=20&grade=Class 12&classBatchId=...`). |
| `GET` | `/api/students/my-dashboard` | `STUDENT` | Complete student dashboard data. |
| `GET` | `/api/students/:id` | All (Ownership Checked) | 360° student profile, attendance summary, test history, and feedback. |
| `POST` | `/api/students` | `ADMIN`, `TEACHER` | Enroll student with auto-generated `studentCode` (`EDU-2026-XXXX`). |
| `POST` | `/api/students/:id/assign-class` | `ADMIN`, `TEACHER` | Assign student to class/batch. |
| `POST` | `/api/students/:id/link-parent` | `SUPER_ADMIN`, `ADMIN` | Link parent account to student. |
| `GET` | `/api/teachers/my-dashboard` | `TEACHER` | Teacher dashboard KPIs, assigned classes, and recent submissions. |
| `GET` | `/api/parents/my-dashboard` | `PARENT` | Parent dashboard with Multi-Child Switcher (`?studentId=...`). |

---

## 3. Classes, Subjects, Timetable & Question Bank

| Method | Endpoint | Roles Allowed | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/courses` | Authenticated | List courses and programs. |
| `GET` | `/api/subjects` | Authenticated | List subjects with nested chapters and topics. |
| `GET` | `/api/classes` | Authenticated | List classes/batches with student and test counts. |
| `POST` | `/api/classes` | `ADMIN`, `TEACHER` | Create a new class/batch. |
| `GET` | `/api/timetable` | Authenticated | Get role-scoped timetable slots. |
| `GET` | `/api/questions` | `ADMIN`, `TEACHER` | Paginated question bank (`?page=1&limit=20&subjectId=...&difficulty=MEDIUM`). |
| `GET` | `/api/questions/organization` | `ADMIN`, `TEACHER` | Subject → Chapter → Topic → Difficulty hierarchy and usage stats. |
| `POST` | `/api/questions` | `ADMIN`, `TEACHER` | Create MCQ, Multi-Select, True/False, Numerical, Short, or Long question. |
| `POST` | `/api/questions/bulk-import` | `ADMIN`, `TEACHER` | Bulk import questions via CSV or JSON array with row validation. |

---

## 4. Tests, Assessments, Auto-Evaluation & Results

| Method | Endpoint | Roles Allowed | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tests` | Authenticated | List tests (students see only published tests assigned to them). |
| `POST` | `/api/tests` | `ADMIN`, `TEACHER` | Create test (Manual selection or Automatic Generator). |
| `POST` | `/api/tests/:id/assign` | `ADMIN`, `TEACHER` | Assign test to batch(es) or individual student(s) and send notifications. |
| `POST` | `/api/tests/:id/start` | `STUDENT` | Start or resume attempt (strips correct answers, recovers saved progress). |
| `POST` | `/api/tests/:id/autosave` | `STUDENT` | Periodic auto-save of student answers and elapsed timer. |
| `POST` | `/api/tests/:id/submit` | `STUDENT` | Submit test, auto-evaluate objective items, compute rank & topic breakdown. |
| `GET` | `/api/results` | Authenticated | List test results (strictly scoped by role and parent-child ownership). |
| `GET` | `/api/results/:id` | Authenticated | Detailed result scorecard and question-by-question review. |

---

## 5. Attendance, Messaging, LMS, Reports & Branded PDFs

| Method | Endpoint | Roles Allowed | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/attendance` | `ADMIN`, `TEACHER` | Mark or bulk-update class attendance and notify absent students/parents. |
| `GET` | `/api/attendance` | Authenticated | Get attendance summary, monthly breakdown, and session records. |
| `GET` | `/api/messages` | Authenticated | List user conversations and unread counts. |
| `POST` | `/api/messages` | Authenticated | Send message in conversation (enforces parent-student privacy). |
| `GET` | `/api/pdf/test-paper/:testId` | `ADMIN`, `TEACHER` | Download branded Test Question Paper PDF. |
| `GET` | `/api/pdf/answer-key/:testId` | `ADMIN`, `TEACHER` | Download branded Answer Key & Solutions PDF. |
| `GET` | `/api/pdf/result/:resultId` | Authenticated | Download branded Student Result Scorecard PDF. |
| `GET` | `/api/pdf/progress-report/:studentId`| Authenticated | Download branded Student Academic Progress Report Card PDF. |
| `GET` | `/api/pdf/attendance-report` | `ADMIN`, `TEACHER` | Download branded Attendance Summary PDF. |
