# Audit Pre-Production Checklist

Tanggal audit awal: 2026-04-15  
Scope: Frontend (`Next.js`), Backend (`NestJS + Prisma`), auth/session, upload, export, DB schema, dependency, operasional aplikasi.
Out of scope: konfigurasi/health machine lokal (laptop dev), service OS lokal, dan issue environment spesifik device.

## Ringkasan Risiko Saat Ini
- `P0 (Blocker)`: 6 item
- `P1 (High)`: 10 item
- `P2 (Medium)`: 8 item
- `P3 (Low)`: 4 item

Status saat ini: **Checklist only (belum fixing)**.

## A. Security Checklist
- [ ] `A1` `P0` Terapkan autentikasi backend berbasis token/session yang tervalidasi untuk semua endpoint sensitif.
  Evidence: [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts) tidak memakai guard/authorization di route CRUD.
- [ ] `A2` `P0` Terapkan otorisasi berbasis role di backend (RBAC), jangan hanya di frontend.
  Evidence: [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts) menerima aksi HR/Manager/Admin tanpa verifikasi actor.
- [ ] `A3` `P0` Hardening cookie session: `httpOnly=true`, `secure=true`, signed/encrypted cookie/JWT.
  Evidence: [app/api/auth/login/route.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/app/api/auth/login/route.ts), [app/api/auth/logout/route.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/app/api/auth/logout/route.ts) set `httpOnly: false`.
- [ ] `A4` `P0` Hilangkan mekanisme login demo/backdoor di production.
  Evidence: [lib/auth-config.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/auth-config.ts) menyimpan `demoUsers`, [app/api/auth/login/route.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/app/api/auth/login/route.ts) menerima `sessionKey`.
- [ ] `A5` `P0` Tutup open-redirect pada endpoint login GET.
  Evidence: [app/api/auth/login/route.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/app/api/auth/login/route.ts) `NextResponse.redirect(new URL(redirectTo,...))` menerima input query.
- [ ] `A6` `P0` Batasi eksposur file private (selfie attendance, receipt reimbursement, dokumen karyawan).
  Evidence: [backend/src/main.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/main.ts) expose `/storage` secara publik.

- [ ] `A7` `P1` Lockdown CORS per domain origin production (bukan `cors: true`).
  Evidence: [backend/src/main.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/main.ts) `NestFactory.create(..., { cors: true })`.
- [ ] `A8` `P1` Tambahkan rate-limit khusus login + endpoint write-heavy.
- [ ] `A9` `P1` Tambahkan proteksi upload: `fileFilter`, `limits.fileSize`, validasi MIME + ekstensi, malware scan hook.
  Evidence: [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts) `FileInterceptor` belum membatasi ukuran/jenis file.
- [ ] `A10` `P1` Sanitasi nama file export terhadap path traversal.
  Evidence: [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts) `generateExport()` membentuk `fileName` dari `reportName` tanpa whitelist karakter ketat.
- [ ] `A11` `P1` Wajibkan HTTPS end-to-end dan HSTS di production.
  Evidence: fallback API base masih `http://127.0.0.1:4000` di [lib/api.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/api.ts), [lib/auth.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/auth.ts), [app/api/auth/login/route.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/app/api/auth/login/route.ts).
- [ ] `A12` `P1` Tambahkan security headers (`helmet`, CSP, X-Frame-Options, Referrer-Policy).
- [ ] `A13` `P1` Ganti default credential DB sample sebelum deploy.
  Evidence: [backend/.env.example](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/.env.example) gunakan `postgres:postgres`.
- [ ] `A14` `P1` Buat audit logging untuk aksi sensitif (approve/reject payroll/reimbursement, perubahan employee).

## B. Dependency & Supply Chain Checklist
- [ ] `B1` `P0` Upgrade `next` ke versi patched (audit temukan `high` DoS).
  Evidence: `npm audit --omit=dev` (root) menemukan advisori GHSA pada `next < 15.5.15`.
- [ ] `B2` `P1` Upgrade `multer` ke versi aman (`>=2.1.1`) + review compatibility.
  Evidence: `npm audit --omit=dev` (backend) temukan multiple `high` DoS advisories.
- [ ] `B3` `P1` Upgrade stack NestJS (`@nestjs/core`, `@nestjs/platform-express`, `@nestjs/common`) sesuai advisori.
- [ ] `B4` `P1` Upgrade Prisma (`prisma`, `@prisma/config`) ke versi patched.
- [ ] `B5` `P1` Evaluasi/ganti `xlsx` library (ada advisory high tanpa fix available di versi saat ini).
- [ ] `B6` `P2` Tambahkan dependency scanning di CI (fail build pada severity threshold).

## C. Performance Checklist
- [x] `C1` `P1` Implement pagination/filtering server-side untuk list besar (`employees`, `attendance`, `reimbursement`, `payslips`).
  Evidence: [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts), [backend/src/common/dtos.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/dtos.ts), [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts), [lib/api.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/api.ts), [lib/payroll.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/payroll.ts).
- [x] `C2` `P1` Optimasi persist DB: hindari `upsert` satu per satu dalam loop besar, gunakan batch strategy.
  Evidence: [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts) `persistSnapshotToDatabase()` sudah pakai `deleteMany + createMany` batched transaction.
- [x] `C3` `P1` Pisahkan job berat (export/generate report) ke async worker queue.
  Evidence: [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts) `enqueueExportJob()/processExportQueue()`, [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts) endpoint status job, [lib/reporting.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/reporting.ts), [lib/payroll.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/payroll.ts) polling status.
- [x] `C4` `P2` Tambahkan response compression di backend.
  Evidence: [backend/src/main.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/main.ts), [backend/package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/package.json).
- [x] `C5` `P2` Definisikan caching strategy (server/API/browser) untuk endpoint read-only.
  Evidence: [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts) `setShortCache()/setNoStore()` diterapkan per endpoint.
- [x] `C6` `P2` Tambahkan index query sesuai pola filter real production (cek dengan EXPLAIN ANALYZE).
  Evidence: [backend/prisma/schema.prisma](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/prisma/schema.prisma), [backend/prisma/migrations/20260416093000_performance_indexes/migration.sql](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/prisma/migrations/20260416093000_performance_indexes/migration.sql).

## D. Reliability & Data Integrity Checklist
- [ ] `D1` `P1` Ganti field tanggal/jam kritis dari `String` ke tipe date/time native DB.
  Evidence: [backend/prisma/schema.prisma](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/prisma/schema.prisma) banyak kolom date/time tersimpan sebagai `String`.
- [ ] `D2` `P1` Tambahkan idempotency guard untuk endpoint aksi mutable (approve/publish/generate).
- [ ] `D3` `P1` Tambahkan global exception filter + error contract konsisten (`4xx/5xx`) untuk observability klien.
- [ ] `D4` `P2` Pisahkan data seed/demo dari runtime production bootstrap.
- [ ] `D5` `P2` Rancang backup/restore drill berkala + RPO/RTO target.
- [ ] `D6` `P2` Tambahkan migration verification gate sebelum release (`prisma migrate deploy` + smoke test).

## E. Observability & Operations Checklist
- [ ] `E1` `P1` Structured logging (JSON), correlation ID, dan request logging middleware.
- [ ] `E2` `P1` Metrics + alerting (latency, error rate, DB connection, queue depth).
- [ ] `E3` `P2` Readiness/liveness probe terpisah untuk deployment orchestration.
- [ ] `E4` `P2` Buat deployment blueprint production (reverse proxy, TLS, secret injection, env matrix).
- [ ] `E5` `P2` Siapkan CI/CD minimum: lint, typecheck, audit, test, build, migrate check.

## F. Quality Assurance Checklist
- [ ] `F1` `P0` Buat automated test minimal untuk alur kritis: auth login, check-in/out, payroll run, reimbursement submit-approve-process.
- [ ] `F2` `P1` Tambahkan integration test API untuk validasi role access dan constraint bisnis.
- [ ] `F3` `P1` Tambahkan E2E smoke test frontend (login per role, dashboard, flow utama).
- [ ] `F4` `P2` Tetapkan performance baseline (p95 endpoint utama + target SLA).

## G. Compliance & Privacy Checklist
- [ ] `G1` `P1` Data classification & retention policy untuk PII/financial/biometric-like media (selfie, receipt).
- [ ] `G2` `P1` Access control untuk dokumen sensitif per role dan per owner.
- [ ] `G3` `P2` Audit trail immutable untuk approval chain (manager/HR/payroll).
- [ ] `G4` `P2` Consent/notice policy untuk penyimpanan dokumen personal.

---

## Urutan Eksekusi Rekomendasi (Sprint Fix)
1. `P0 Security`: auth backend + RBAC + cookie hardening + matikan demo login + tutup open redirect + proteksi file private.
2. `P0/P1 Dependency`: upgrade paket high risk (`next`, `multer`, NestJS, Prisma) + mitigasi `xlsx`.
3. `P1 Reliability`: refactor date/time schema + error handling + idempotency.
4. `P1/P2 Performance`: pagination, batch write, caching/compression, async jobs export.
5. `P1/P2 Ops & QA`: logging/metrics/alerts + CI/CD + automated tests.
