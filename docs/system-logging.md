# System Logging

Sistem sekarang menulis log terpusat ke:

- `logs/system/system-events.ndjson`

Format log:

- Satu baris = satu JSON event
- Field utama: `timestamp`, `level`, `source`, `event`, `details`

Source yang dicatat:

- `backend`
- `frontend-server`
- `frontend-client`

Event yang otomatis masuk:

- startup backend
- backend ready
- backend bootstrap failure
- backend uncaught exception / unhandled rejection
- backend HTTP 5xx response
- frontend server startup register
- frontend server uncaught exception / unhandled rejection
- client-side browser error
- client-side unhandled promise rejection

Contoh baca log terakhir di PowerShell:

```powershell
Get-Content .\logs\system\system-events.ndjson -Tail 50
```

Contoh filter error saja:

```powershell
Get-Content .\logs\system\system-events.ndjson |
  ConvertFrom-Json |
  Where-Object { $_.level -eq "error" } |
  Select-Object timestamp, source, event, details
```

Catatan:

- Log ini fokus untuk trace operasional aplikasi, bukan audit bisnis.
- Kalau frontend/backend gagal start, event bootstrap failure akan tercatat selama proses sempat mengeksekusi handler.
- Browser/client error akan dikirim ke server lewat endpoint internal `/api/system/client-error`.
