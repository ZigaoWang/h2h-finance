#!/usr/bin/env bash
# Deploys the `main` branch from GitHub. Run it from your machine:
#
#   npm run deploy
#
# Locally it checks that everything is committed and pushed, then runs itself on the server,
# where it builds a fresh release from GitHub, switches to it, and switches back automatically
# if the new release doesn't pass its health check. Data lives outside the releases and is
# backed up before every switch.
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-root@finance.h2h.ykps.net}"
APP_DIR="${APP_DIR:-/www/wwwroot/finance.h2h.ykps.net}"
REPO="${REPO:-https://github.com/ZigaoWang/h2h-finance.git}"
BRANCH="${BRANCH:-main}"
PROCESS="${PROCESS:-h2h-finance}"
KEEP=3

say() { printf '\033[1m%s\033[0m\n' "$*"; }

# On your machine ------------------------------------------------------------------------------
if [[ "${1:-}" != "--on-server" ]]; then
  cd "$(dirname "$0")/.."
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Commit or stash your changes first; only what's on GitHub gets deployed." >&2
    exit 1
  fi
  git fetch --quiet origin "$BRANCH"
  if [[ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH")" ]]; then
    echo "Your $BRANCH and GitHub's differ. Push (or pull) first, then deploy." >&2
    exit 1
  fi
  say "Deploying $(git log -1 --format='%h %s') to $DEPLOY_HOST"
  ssh "$DEPLOY_HOST" "APP_DIR='$APP_DIR' REPO='$REPO' BRANCH='$BRANCH' PROCESS='$PROCESS' bash -s -- --on-server" < "$0"
  exit $?
fi

# On the server --------------------------------------------------------------------------------
ENV_FILE="$APP_DIR/.env"
RELEASES="$APP_DIR/releases"
CURRENT="$APP_DIR/current"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE (see .env.example)." >&2; exit 1; }
set -a; source "$ENV_FILE"; set +a
: "${PORT:?PORT must be set in $ENV_FILE}" "${DATA_DIR:?DATA_DIR must be set in $ENV_FILE}"

commit="$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -c1-12)"
release="$RELEASES/$(date +%Y%m%d-%H%M%S)-$commit"
previous="$(readlink -f "$CURRENT" 2>/dev/null || true)"

say "Building $commit"
mkdir -p "$RELEASES"
# A build that fails partway leaves nothing behind.
trap 'rm -rf "$release"' ERR
git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" "$release"
cd "$release"
# The build tools are dev dependencies, which NODE_ENV=production from .env would otherwise skip.
npm ci --include=dev --no-audit --no-fund --loglevel=error
npm run build >/dev/null
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
trap - ERR

healthy() {
  for _ in $(seq 1 30); do
    curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

SERVER_JS="$CURRENT/.next/standalone/server.js"

# Where pm2 thinks the process's script lives, or nothing if it isn't running.
pm2_script() {
  pm2 jlist 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const p = JSON.parse(s || "[]").find((x) => x.name === process.argv[1]);
      process.stdout.write(p ? p.pm2_env.pm_exec_path : "");
    });' "$PROCESS"
}

start() {
  ln -sfn "$1" "$CURRENT"
  # pm2 is pointed at the `current` link, so a restart always runs whichever release it names.
  # A process set up some other way is replaced once.
  if [[ "$(pm2_script)" == "$SERVER_JS" ]]; then
    pm2 restart "$PROCESS" >/dev/null
  else
    pm2 delete "$PROCESS" >/dev/null 2>&1 || true
    (cd "$CURRENT/.next/standalone" && pm2 start "$SERVER_JS" --name "$PROCESS" --node-args="--env-file=$ENV_FILE" >/dev/null)
  fi
}

say "Backing up the database"
if [[ -f "$DATA_DIR/h2h.db" ]]; then
  DATA_DIR="$DATA_DIR" node scripts/backup.mjs
fi

say "Switching to the new release"
start "$release"
if ! healthy; then
  say "Health check failed; switching back"
  if [[ -n "$previous" && -d "$previous" ]]; then
    start "$previous"
    healthy && say "Back on the previous release."
  fi
  exit 1
fi
pm2 save >/dev/null

# Keep the newest few releases for quick rollbacks.
ls -1dt "$RELEASES"/*/ | tail -n +$((KEEP + 1)) | while read -r old; do
  [[ "$(readlink -f "$old")" == "$(readlink -f "$CURRENT")" ]] || rm -rf "$old"
done

say "Live: $commit"
