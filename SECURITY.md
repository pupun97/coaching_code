# Security Architecture & Data Privacy — EduNexus Platform

## 1. Authentication & Credential Security

- **Password Hashing**: Passwords are hashed using `bcryptjs` (configurable salt rounds, default `10`). Plaintext passwords are never stored or logged.
- **Password Complexity Policy**: Enforces minimum 8 characters with uppercase, lowercase, and numeric characters via DTO validation.
- **Brute-Force & Account Lockout Protection**:
  - `User.failedLoginAttempts` increments on each failed login.
  - After `MAX_FAILED_LOGIN_ATTEMPTS` (default `5`), `User.lockedUntil` locks the account for `ACCOUNT_LOCKOUT_MINUTES` (default `15` minutes) and records an `ACCOUNT_LOCKED_FAILED_LOGINS` audit event.
- **JWT Access + Refresh Token Rotation**:
  - Short-lived JWT Access Tokens (`Authorization: Bearer <token>`) paired with cryptographically random Refresh Tokens stored as SHA-256 hashes in the `RefreshToken` table.
  - Calling `/api/auth/refresh` revokes the used refresh token and issues a rotated pair.

---

## 2. Backend-Enforced Role-Based Access Control (RBAC)

Authorization is enforced on every API request via global NestJS guards (`JwtAuthGuard` and `RolesGuard`):
- **Student Isolation**:
  - Students cannot access `/api/questions`, `/api/users`, `/api/audit-logs`, or test creation endpoints (`403 Forbidden`).
  - Students can only view their own profile (`actor.studentId === studentId`) and can only start/submit tests assigned to their batch or student ID.
  - During an active exam (`IN_PROGRESS`), the backend strips `isCorrect`, `explanation`, `correctTextAnswer`, and `numericalAnswer` from all question payloads.
- **Parent-Child Ownership Enforcement**:
  - Every parent request to view a student profile, test result, attendance record, or progress report card verifies a matching link in `ParentStudent` (`parentId: actor.parentId, studentId`).
  - Parent A is strictly blocked (`403 Forbidden`) from viewing Parent B's children.
- **Teacher Scoping**:
  - Teachers cannot access Admin-only user management, system settings, or security audit logs (`403 Forbidden`).

---

## 3. HTTP Security, File Validation & Audit Trail

- **Security Headers & Rate Limiting**:
  - `helmet` configures secure HTTP headers.
  - `@nestjs/throttler` enforces global rate limiting per IP.
- **File Upload Validation (`StorageService`)**:
  - Validates non-empty buffer, maximum file size (`MAX_FILE_SIZE_MB`), allowlisted MIME types, and blocks executable extensions (`.exe`, `.bat`, `.cmd`, `.sh`, `.php`, `.js`).
- **Audit Logging (`AuditLogsService`)**:
  - Records administrative and security actions (`USER_LOGIN`, `LOGIN_FAILED`, `ACCOUNT_LOCKED_FAILED_LOGINS`, `USER_CREATED`, `USER_ROLE_CHANGED`, `ADMIN_PASSWORD_RESET`, `TEST_CREATED`, `TEST_PUBLISHED`, `TEST_ASSIGNED`, `ATTENDANCE_MARKED`, `RESULT_MODIFIED_SUBJECTIVE_GRADING`, `SETTINGS_UPDATED`).
