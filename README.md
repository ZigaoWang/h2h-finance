# H2H Finance

Budget and spending for Heart to Heart, the student charity at YK Pao School that funds heart surgery for children.

The home page is a public view of the budget and spending for donors and sponsors, without receipts, names, shops or private notes. Members sign in to add expenses from their phones: they upload the payment screenshot and the amount, shop, date and transaction number are read from it automatically. At the end of the year an admin downloads one zip with a spreadsheet of every expense and every receipt.

## What it does

- **Simple sign-in.** Members enter the team password, then find their name in the list or add it if they're new (at most 10 new names a day). The list only appears after the password, so names stay private. Admins also enter the admin password. A device stays signed in for 90 days of use; wrong passwords are throttled per IP, and changing the team password signs everyone out. Every sign-in is recorded.
- **Fast submission.** Pick several screenshots at once; each becomes an expense with its amount, shop, date and transaction number read by OCR (WeChat Pay, Alipay, shopping apps; Chinese and English). Each screenshot is read at three sizes and the readings vote, using Tesseract's confidence, so a garbled read is left blank rather than filled in wrong. Expenses count as soon as they're submitted; the club trusts its members.
- **Duplicate and mismatch warnings.** Uploads are checked against earlier receipts by exact hash, perceptual hash and transaction number, and expenses whose amount or date differ from their screenshot are flagged. The transaction number embeds the payment date, which catches mistyped dates.
- **Nothing changes quietly.** Members can edit or delete their own expenses and admins anyone's, but every change is listed in the expense's history with who made it, deleted expenses stay on record (and can be restored), and the database itself keeps every earlier version of every expense (`drizzle/0003_editable-history.sql`). The audit log is append-only.
- **Private proof.** Receipts are only visible to admins and the member who submitted them. Image metadata (including location) is stripped on upload.
- **Dashboard.** Spending against the budget and against how much of the year has gone, average and largest expense, this month against last, and breakdowns by category, event, person and month. Admins can search and filter every expense.
- **Public home page.** `/` shows the budget, totals and breakdowns; it can be switched off in Settings.
- **Year-end pack.** Settings → Budget → *Year-end pack* downloads a zip with a spreadsheet (summary, every expense, audit log) and every receipt, named to match the spreadsheet rows.
- **English and Chinese** throughout, including the export.

## Stack

Next.js 16 (App Router, server actions) · TypeScript · SQLite via better-sqlite3 and Drizzle ORM · Tailwind CSS 4 · next-intl · Tesseract (bundled, runs offline) · sharp · ExcelJS.

Everything runs in one Node process with one data directory, which keeps hosting, backups and maintenance simple for a club. It calls no external services at all, so it works the same on a server inside mainland China.

## Local development

Requires Node 22 or newer.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000/login. The first visit goes to a one-time setup page where you enter your name, the admin password and the team password.

```sh
npm test          # unit tests (receipt parsing, money, database rules)
npm run typecheck
npm run lint
```

After changing `src/lib/db/schema.ts`, run `npm run db:generate` to create a migration. Migrations run automatically on startup.

## Deployment

The app ships as a Docker image. On the server:

```sh
git clone <repo> h2h-finance && cd h2h-finance
cp .env.example .env          # set AUTH_SECRET
mkdir -p data && sudo chown 1001:1001 data
docker compose up -d --build
```

Then open `/login` straight away and complete the one-time setup (your name, admin password, team password). Until that's done, whoever opens the site first can do it. Add the other admins in Settings → Members.

In mainland China, use an npm mirror for the build:

```sh
docker compose build --build-arg NPM_REGISTRY=https://registry.npmmirror.com
```

### Environment

| Variable | |
| --- | --- |
| `AUTH_SECRET` | Required. Random, 32+ characters: `openssl rand -base64 48` |
| `DATA_DIR` | Where the database and receipts live. `/data` in Docker. |

Passwords are set on the setup page and changed later in Settings → Access; they're stored as scrypt hashes, never in plain text.

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
        proxy_set_header X-Forwarded-For $remote_addr;   # used to throttle wrong passwords
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
  (app)/              Signed-in area: dashboard, expenses, all expenses, settings
  page.tsx            Public home page
  setup/, login/      First-run setup and sign-in
  api/                Uploads, private file access, export, health check
src/components/       UI
src/lib/              Domain logic: auth, expenses, files and OCR, stats, export
```

Every server action and route checks the session itself; nothing relies on page layouts for authorization. Expected failures (a deleted expense, a rate limit) come back as error codes that the UI translates.

## License

Copyright © 2026 Zigao Wang. Licensed under the [GNU Affero General Public License v3.0 or later](LICENSE).

You're welcome to run this for your own club or charity and to change it. If you run a modified version where others can use it, the AGPL asks you to share your changes under the same license, so improvements stay open for everyone.
