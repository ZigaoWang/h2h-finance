// Writes a consistent snapshot of the database next to the receipts, safe to run while the app is live:
//   docker compose exec app node scripts/backup.mjs
// Then copy the whole data directory (database, backups and files/) somewhere off the server.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = path.resolve(process.env.DATA_DIR ?? "./data");
const backupDir = path.join(dataDir, "backups");
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const target = path.join(backupDir, `h2h-${stamp}.db`);
const db = new Database(path.join(dataDir, "h2h.db"), { readonly: true });
await db.backup(target);
db.close();
console.log(`Backed up to ${target}`);
