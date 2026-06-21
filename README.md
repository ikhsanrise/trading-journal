# Trading Journal — Setup Guide

Panduan lengkap untuk menjalankan app dari nol.

---

## Prasyarat

Pastikan sudah install:
- [Node.js LTS](https://nodejs.org) — cek dengan `node -v`
- [Git](https://git-scm.com)
- [VS Code](https://code.visualstudio.com)

---

## Langkah 1 — Setup project di komputer lokal

Buka Terminal (Mac) atau Command Prompt (Windows), lalu jalankan:

```bash
# Masuk ke folder project
cd trading-journal

# Install semua dependencies
npm install

# Generate Prisma client
npm run db:generate
```

---

## Langkah 2 — Buat database di Supabase (gratis)

1. Daftar di [supabase.com](https://supabase.com)
2. Klik **New Project** → isi nama project dan password database
3. Tunggu ~2 menit sampai project siap
4. Klik **Settings** → **Database** → copy **Connection string (URI)**
5. Ganti `[YOUR-PASSWORD]` di connection string dengan password yang kamu buat

---

## Langkah 3 — Buat file `.env`

Di folder project, buat file bernama `.env` (copy dari `.env.example`):

```bash
cp .env.example .env
```

Buka `.env` di VS Code, isi dengan:

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
AUTH_SECRET="isi-random-string-panjang-minimal-32-karakter"
AUTH_URL="http://localhost:3000"
```

Untuk `AUTH_SECRET`, bisa generate di Terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Langkah 4 — Setup database & data awal

```bash
# Push schema ke database
npm run db:push

# (Opsional) Isi data sample
npm run db:seed
```

---

## Langkah 5 — Jalankan app

```bash
npm run dev
```

Buka browser: **http://localhost:3000**

Login dengan:
- Email: `trader@example.com`
- Password: `password` *(setelah seed — untuk production ganti dengan bcrypt)*

---

## Langkah 6 — Deploy ke Vercel (online)

1. Upload kode ke GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # Buat repo baru di github.com, lalu:
   git remote add origin https://github.com/USERNAME/trading-journal.git
   git push -u origin main
   ```

2. Daftar di [vercel.com](https://vercel.com) → **Import Project** → pilih repo GitHub

3. Di bagian **Environment Variables**, tambahkan:
   - `DATABASE_URL` — sama dengan di `.env`
   - `AUTH_SECRET` — sama dengan di `.env`
   - `AUTH_URL` — ganti dengan URL Vercel kamu (contoh: `https://trading-journal-xyz.vercel.app`)

4. Klik **Deploy** — tunggu ~2 menit, app langsung online!

---

## Struktur folder project

```
trading-journal/
├── prisma/
│   ├── schema.prisma      # Struktur database
│   └── seed.ts            # Data sample
├── src/
│   ├── app/
│   │   ├── (app)/         # Halaman utama (butuh login)
│   │   │   ├── dashboard/ # Halaman dashboard
│   │   │   ├── trades/    # Trade log
│   │   │   ├── analytics/ # Analytics (Fase 2)
│   │   │   ├── calendar/  # Kalender (Fase 2)
│   │   │   └── playbook/  # Playbook (Fase 2)
│   │   ├── api/           # Backend API routes
│   │   │   ├── auth/      # NextAuth handler
│   │   │   ├── dashboard/ # Stats & chart data
│   │   │   ├── trades/    # CRUD trade + import CSV
│   │   │   └── setups/    # Setup/strategi
│   │   ├── login/         # Halaman login
│   │   └── layout.tsx     # Root layout
│   ├── auth.ts            # Konfigurasi NextAuth
│   ├── components/
│   │   ├── layout/        # Sidebar, Topbar
│   │   └── trades/        # Form & modal trade
│   ├── lib/
│   │   ├── prisma.ts      # Database client
│   │   └── utils.ts       # Kalkulasi & helper
│   └── types/             # TypeScript types
├── .env                   # Environment variables (jangan di-commit!)
├── .env.example           # Template .env
├── next.config.js
├── tailwind.config.ts
└── package.json
```

---

## Troubleshooting umum

**Error: `Cannot find module '@prisma/client'`**
```bash
npm run db:generate
```

**Error: database connection refused**
→ Cek `DATABASE_URL` di `.env`, pastikan password dan project-ref benar

**Halaman putih / error di browser**
→ Buka Terminal → lihat error di output `npm run dev`

**Tidak bisa login**
→ Pastikan `npm run db:seed` sudah dijalankan

---

## Fase berikutnya

- **Fase 2**: Analytics mendalam, calendar heatmap full, playbook, upload screenshot
- **Fase 3**: Sinkronisasi broker API, AI trade review, notifikasi
# trading-journal
# trading-journal
# trading-journal
# trading-journal
# trading-journal
