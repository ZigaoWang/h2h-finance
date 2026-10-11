# H2H Finance

Budget, expenses and reimbursements for Heart to Heart, the student charity at YK Pao School that funds heart surgery for children.

Members submit payment screenshots from their phones; the amount, shop and date are read from the screenshot automatically. The club lead reviews each expense next to its proof, pays members back, and at the end of the year downloads one zip with a spreadsheet of every expense and every receipt. An optional public page shows donors where the money went, without receipts, names or private notes.

## What it does

- **Invite-only sign-in.** Admins add members by email; members sign in with a 6-digit code sent to that email. No passwords, no public sign-up. Codes are rate-limited per address and per IP, expire after 10 minutes and allow five attempts.
- **Fast submission.** Pick several screenshots at once; each becomes one expense with its amount, shop and date filled in by OCR (WeChat Pay, Alipay, shopping apps; Chinese and English). Choose a category, optionally an event, say what it was for, submit.
- **Duplicate detection.** Every upload is checked against earlier proof by exact hash and by a perceptual hash (catches re-saved or recompressed screenshots), and against expenses with the same amount, shop and date. Members see a warning; reviewers see the match.
- **Review and pay back.** Admins approve or reject (with a reason) from a queue with the screenshot beside the details. Paying back means selecting a member's approved expenses and attaching the transfer screenshot; the transfer amount is checked against the total.
- **Records that can't be quietly changed.** Once approved, an expense can't be edited or deleted. A mistaken approval can only be *voided*, which keeps it on record with a reason. Reimbursements and the audit log are append-only. These rules are enforced by SQLite triggers (`drizzle/0001_integrity.sql`) as well as in the app, so not even a manual database session can rewrite history.
- **Private proof.** Receipts are only visible to admins and the member who submitted them; transfer screenshots to admins and the member who was paid. Image metadata (including location) is stripped on upload.
- **Dashboard.** Budget, spending, remaining, pending and owed amounts, broken down by category, event, person and month.
- **Public page.** `/transparency`, switched on or off in Admin → Budget.
- **Year-end pack.** Admin → Budget → *Year-end pack* downloads a zip containing a spreadsheet (summary, every expense, reimbursements, audit log) and every receipt and transfer screenshot, named to match the spreadsheet rows.
- **English and Chinese** throughout, including emails and the export.

## Stack

Next.js 16 (App Router, server actions) · TypeScript · SQLite via better-sqlite3 and Drizzle ORM · Tailwind CSS 4 · next-intl · Tesseract (bundled, runs offline) · sharp · ExcelJS.

Everything runs in one Node process with one data directory, which keeps hosting, backups and maintenance simple for a club. Nothing calls external services except your SMTP server, so it works the same on a server inside mainland China.

## Local development

Requires Node 22 or newer.

```sh
npm install
cp .env.example .env.local   # set BOOTSTRAP_ADMIN_EMAIL to your address
npm run dev
```

Open http://localhost:3000 and sign in with the bootstrap admin email. Without `SMTP_HOST`, sign-in codes are printed in the terminal instead of emailed.

```sh
npm test          # unit tests (receipt parsing, money)
npm run typecheck
npm run lint
```

After changing `src/lib/db/schema.ts`, run `npm run db:generate` to create a migration. Migrations run automatically on startup.

## Deployment

The app ships as a Docker image. On the server:

```sh
git clone <repo> h2h-finance && cd h2h-finance
cp .env.example .env          # fill in every value, see below
mkdir -p data && sudo chown 1001:1001 data
docker compose up -d --build
```

In mainland China, use an npm mirror for the build:

```sh
docker compose build --build-arg NPM_REGISTRY=https://registry.npmmirror.com
```

### Environment

| Variable | |
| --- | --- |
| `AUTH_SECRET` | Required. Random, 32+ characters: `openssl rand -base64 48` |
| `BOOTSTRAP_ADMIN_EMAIL` | Made an admin on every start, so you can always get back in. |
| `BOOTSTRAP_ADMIN_NAME` | Display name for that admin. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Outgoing mail for sign-in codes. Port 465 uses TLS. |
| `MAIL_FROM` | Sender, e.g. `H2H Finance <finance@h2h.ykps.net>`. |
| `DATA_DIR` | Where the database and receipts live. `/data` in Docker. |

Any SMTP provider works (the school's mail server, Tencent Exmail, Aliyun DirectMail, Resend…). Set up SPF and DKIM for the sending domain so codes don't land in spam.

### Reverse proxy

The container listens on `127.0.0.1:3000`. Put it behind nginx (or Caddy) with HTTPS on a subdomain such as `finance.h2h.ykps.net`:

```nginx
server {
    listen 443 ssl http2;
    server_name finance.h2h.ykps.net;
    # ssl_certificate ... (e.g. from certbot)

    client_max_body_size 20m;   # receipts can be up to 15 MB; nginx's default of 1 MB would block uploads

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;   # used for sign-in rate limiting
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

HTTPS is required: the session cookie is marked `Secure` in production.

### Backups

Everything lives in `data/`: the database (`h2h.db`) and receipts (`files/`). To back up:

```sh
docker compose exec app node scripts/backup.mjs   # consistent snapshot into data/backups/
rsync -a data/ backup-host:h2h-finance/           # then copy the whole directory off the server
```

Run both from cron daily. To restore, stop the app, put the directory back (rename the snapshot to `h2h.db`) and start it again.

## Project layout

```
drizzle/              SQL migrations, including the integrity triggers
messages/             English and Chinese text
scripts/backup.mjs    Database snapshot
src/app/              Pages, server actions and API routes
  (app)/              Signed-in area: dashboard, expenses, review, pay back, admin
  transparency/       Public page
  api/                Uploads, private file access, export, health check
src/components/       UI
src/lib/              Domain logic: auth, expenses, files and OCR, stats, export
```

Every server action and route checks the session itself; nothing relies on page layouts for authorization. Expected failures (a locked expense, a rate limit) come back as error codes that the UI translates.
