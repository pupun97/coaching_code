# EduNexus — Coaching Center Management & Learning Platform

A production-grade, full-stack SaaS Coaching Center Management & Computer-Based Learning Platform built with **Angular 18+**, **NestJS 10+**, **Prisma ORM**, and **PostgreSQL / SQLite**.

---

## 1. Key Highlights & Capabilities

- **5 Role-Based Portals with Backend-Enforced RBAC**:
  - **Super Admin** (`/admin/dashboard`): Unrestricted governance, branding, system settings, and security audit logs.
  - **Admin / Center Manager** (`/admin/dashboard`): User management, student admissions (auto-generated Student IDs), teacher onboarding, batch management, timetables, announcements, and CSV/PDF reports.
  - **Teacher / Faculty** (`/teacher/dashboard`): Hierarchical Question Bank (Subject → Chapter → Topic → Difficulty), CSV bulk import with validation, Manual & Automatic Test Generator, subjective answer grading, daily attendance marker, study materials, homework/DPP, and structured student feedback.
  - **Student** (`/student/dashboard`): Assigned tests, NTA-style Computer-Based Test (CBT) interface with live countdown timer, question palette, mark-for-review, 15-second periodic auto-save & browser refresh recovery, instant objective evaluation, topic-level analytics, attendance history, and branded PDF Progress Report Card download.
  - **Parent / Guardian** (`/parent/dashboard`): Multi-Child Switcher (1 parent linked to 1 or multiple children), child performance charts, attendance tracking, teacher feedback, and direct teacher messaging with strict data privacy enforcement.
- **Public Marketing Website**:
  - Home, About Us, Courses, Faculty profiles, FAQ, and Contact page with live admission enquiry submission.
- **Reusable Branded PDF Engine (`PDFKit`)**:
  - Dynamically applies center name, monogram logo, address, and footer from Admin Settings to generate:
    1. Test Question Paper PDF (`/api/pdf/test-paper/:testId`)
    2. Official Answer Key & Explanations PDF (`/api/pdf/answer-key/:testId`)
    3. Student Test Result Scorecard PDF (`/api/pdf/result/:resultId`)
    4. Student Academic Progress Report Card PDF (`/api/pdf/progress-report/:studentId`)
    5. Attendance Summary Report PDF (`/api/pdf/attendance-report`)

---

## 2. Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Angular 18 (Standalone Components, Signals, Reactive/Template Forms), Angular Material 3, SCSS |
| **Backend** | Node.js 20+, NestJS 10, TypeScript, Passport JWT, Helmet, Throttler, Class-Validator |
| **Database & ORM** | Prisma ORM (`prisma/schema.postgresql.prisma` for PostgreSQL 16 & `prisma/schema.prisma` for zero-config local dev) |
| **PDF & Exports** | PDFKit (Branded PDF streams), RFC-4180 CSV/Excel exporter |
| **DevOps & CI/CD** | Docker, Docker Compose, Nginx, GitHub Actions (`.github/workflows/ci.yml`) |

---

## 3. Quick Start (Local Development)

### Prerequisites
- Node.js `v20+` and `npm v10+`

### Step 1: Setup, Migrate & Seed the Backend
```bash
cd backend
cp ../.env.example .env
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run start:dev
```
- The REST API starts at **`http://localhost:3000/api`**
- Interactive Swagger/OpenAPI documentation is available at **`http://localhost:3000/api/docs`**

### Step 2: Start the Angular Frontend
```bash
cd frontend
npm install
npm start
```
- Open **`http://localhost:4200`** in your browser.

---

## 4. Development Seed Credentials

> **Note**: These credentials are seeded by `prisma/seed.ts` for local development and QA verification only.

| Role | Email / Identifier | Password | Portal Redirect | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@edunexus.edu` | `Admin@123` | `/admin/dashboard` | Full system & settings control |
| **Center Admin** | `admin@edunexus.edu` | `Admin@123` | `/admin/dashboard` | User, batch, and report management |
| **Teacher (Physics)** | `dr.sharma@edunexus.edu` | `Teacher@123` | `/teacher/dashboard` | Assigned to JEE & NEET batches |
| **Teacher (Math)** | `prof.verma@edunexus.edu` | `Teacher@123` | `/teacher/dashboard` | Assigned to JEE & Class 10 batches |
| **Teacher (Chem/Bio)**| `ms.iyer@edunexus.edu` | `Teacher@123` | `/teacher/dashboard` | Assigned to JEE & NEET batches |
| **Student 1** | `student1@edunexus.edu` | `Student@123` | `/student/dashboard` | Aarav Mehta (`EDU-2026-0001`, JEE Batch A) |
| **Student 2** | `student2@edunexus.edu` | `Student@123` | `/student/dashboard` | Diya Mehta (`EDU-2026-0002`, JEE Batch A) |
| **Parent 1** | `parent1@edunexus.edu` | `Parent@123` | `/parent/dashboard` | Linked to **both** Aarav Mehta & Diya Mehta |

---

## 5. Running Automated Tests & Production Builds

### Backend Unit & End-to-End RBAC / Workflow Tests
```bash
cd backend
npm test
npm run build
```

### Frontend Production Build
```bash
cd frontend
npm run build
```

### Docker Compose (PostgreSQL 16 + Backend + Frontend Nginx)
```bash
docker compose up --build -d
```

---

## 6. Additional Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System & modular design, state management, and provider abstractions
- [DATABASE.md](./DATABASE.md) — Complete 29-entity relational schema, indexes, and ER diagram
- [API.md](./API.md) — REST API endpoints, query parameters, and payloads
- [SECURITY.md](./SECURITY.md) — Authentication, token rotation, RBAC, and student/parent data privacy
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Environment configuration, Docker, and cloud deployment guide
