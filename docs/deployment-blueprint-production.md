# Production Deployment Blueprint

## 1) Topology
- `Frontend`: Next.js (`3000`) behind reverse proxy.
- `Backend`: NestJS API (`4000`) private network only (allow from reverse proxy/app network).
- `Database`: PostgreSQL managed/private subnet.
- `Storage`: shared persistent volume/object storage for `/storage/*`.

## 2) Reverse Proxy + TLS
- Terminate TLS at reverse proxy (Nginx/Traefik/ALB).
- Force HTTPS redirect (`80 -> 443`).
- Forward `X-Forwarded-Proto=https` ke backend.
- Forward `X-Request-Id` untuk correlation ID lintas service.

Example routing:
- `https://hr.pralux.co.id/` -> Next.js `:3000`
- `https://hr.pralux.co.id/api/*` -> NestJS `:4000/api/*`
- `https://hr.pralux.co.id/storage/*` -> NestJS `:4000/storage/*` (tetap role-gated di backend)

## 3) Secret Injection
- Jangan commit `.env` production ke repo.
- Inject secret dari secret manager/CI variables:
  - `DATABASE_URL`
  - `APP_SESSION_SECRET`
  - `CORS_ORIGINS`
  - `ENFORCE_BACKEND_AUTH=true`
  - `NODE_ENV=production`
- Rotate credential secara berkala (DB password + session secret).

## 4) Environment Matrix
- `development`: `APP_STORAGE_MODE=database|json`, `ENFORCE_BACKEND_AUTH=false` (opsional lokal).
- `staging`: mirror production config, test data terisolasi.
- `production`: `APP_STORAGE_MODE=database`, `ENFORCE_BACKEND_AUTH=true`, HTTPS only.

## 5) Probes (Orchestration)
- Liveness: `GET /api/health/live`
- Readiness: `GET /api/health/ready`
- General health: `GET /api/health`
- Metrics + alerts snapshot: `GET /api/ops/metrics`

Suggested probe config:
- liveness interval: 15s, timeout: 3s, failure threshold: 3
- readiness interval: 10s, timeout: 3s, failure threshold: 3

## 6) Release Flow
1. Run CI pipeline (`lint/typecheck/audit/build/migration check/smoke`).
2. Deploy backend, wait readiness green.
3. Deploy frontend.
4. Smoke check:
   - login HR/manager/employee
   - attendance check-in/out
   - reimbursement submit/approve
   - reports export

## 7) Rollback
- Keep previous container/artifact revision.
- Rollback app revision first, then run DB rollback plan if migration is incompatible.
- Validate probes + smoke test after rollback.
