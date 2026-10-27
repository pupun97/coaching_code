# Deployment Guide — EduNexus Platform

## 1. Environment Configuration

Copy `.env.example` to `.env` (in root for Docker Compose and `backend/.env` for local backend execution).

| Variable | Description | Production Recommendation |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` \| `staging` \| `production` | `production` |
| `PORT` | Backend HTTP port | `3000` |
| `DATABASE_URL` | Prisma database connection string | `postgresql://user:pass@host:5432/edunexus_db?schema=public` |
| `JWT_ACCESS_SECRET` | 256-bit secret for signing access tokens | Strong random secret via KMS / Secrets Manager |
| `JWT_REFRESH_SECRET` | 256-bit secret for signing refresh tokens | Strong random secret via KMS / Secrets Manager |
| `STORAGE_DRIVER` | `local` \| `s3` \| `r2` \| `gcs` \| `azure` | `s3` / `r2` / `gcs` in production |
| `EMAIL_PROVIDER` | `console` \| `smtp` \| `sendgrid` | `smtp` or `sendgrid` |
| `CORS_ORIGIN` | Allowed frontend origin(s) | `https://app.yourdomain.com` |

---

## 2. Docker Compose Deployment (PostgreSQL + Backend + Frontend)

The repository includes production-ready Dockerfiles for both `backend/` and `frontend/` (Nginx with gzip and `/api/` reverse proxy) alongside `docker-compose.yml`:

```bash
# 1. Configure environment variables
cp .env.example .env

# 2. Build and launch PostgreSQL 16, NestJS API, and Angular Nginx containers
docker compose up --build -d

# 3. Seed initial administrative data (optional for first-time staging setup)
docker exec -it edunexus-backend npm run prisma:seed
```

- **Frontend Application**: `http://localhost:4200`
- **Backend API**: `http://localhost:3000/api`
- **Swagger Docs**: `http://localhost:3000/api/docs`

---

## 3. Switching Prisma Between Local SQLite and Production PostgreSQL

- **Local Zero-Config Development**: Uses `backend/prisma/schema.prisma` (`provider = "sqlite"`, `DATABASE_URL="file:./dev.db"`).
- **Production PostgreSQL 16**: Uses `backend/prisma/schema.postgresql.prisma` (`provider = "postgresql"`):
  ```bash
  cd backend
  npx prisma generate --schema=./prisma/schema.postgresql.prisma
  npx prisma migrate deploy --schema=./prisma/schema.postgresql.prisma
  ```

---

## 4. CI/CD Pipeline

GitHub Actions workflow is configured in `.github/workflows/ci.yml` and executes:
1. Dependency installation (`npm ci`)
2. Prisma Client generation & TypeScript type-checking (`tsc --noEmit`)
3. Database schema push & seed verification
4. Automated Unit & E2E RBAC/Workflow test suite (`npm test`)
5. Production builds for Backend (`nest build`) and Frontend (`ng build --configuration production`)
6. Docker Compose configuration validation (`docker compose config`)
