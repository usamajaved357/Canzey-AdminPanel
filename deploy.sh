#!/usr/bin/env bash
#
# One-command deploy: push to GitHub + update live server
#
# Usage:
#   ./deploy.sh              # backend only (default)
#   ./deploy.sh --with-ui    # backend + rebuild admin frontend
#
# First time only:
#   chmod +x deploy.sh
#   ssh-copy-id root@199.231.184.194
#

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

SERVER="${DEPLOY_SERVER:-root@199.231.184.194}"
APP_DIR="${APP_DIR:-/var/www/Canzey-AdminPanel}"
PM2_NAME="${PM2_NAME:-canzey-backend}"
BRANCH="${DEPLOY_BRANCH:-main}"
BUILD_CLIENT=0

if [[ "${1:-}" == "--with-ui" ]]; then
  BUILD_CLIENT=1
fi

echo "╔══════════════════════════════════════╗"
echo "║   Canzey Admin — Push & Deploy       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Git push (if there are commits to push or uncommitted deploy-related files) ──
if [[ -n "$(git status --porcelain)" ]]; then
  echo "→ Staging deploy-related changes..."
  git add \
    server/config/loadEnv.js \
    server/server.js \
    server/services/zmcCargoService.js \
    scripts/ \
    .github/ \
    deploy.sh \
    client/src/styles/ \
    client/src/index.css \
    client/src/pages/ \
    client/src/components/ \
    2>/dev/null || true

  if [[ -n "$(git diff --cached --name-only)" ]]; then
    git commit -m "Fix PM2 env loading, responsive UI, and add deploy scripts" || true
  fi
fi

AHEAD=$(git rev-list --count "origin/${BRANCH}..HEAD" 2>/dev/null || echo "0")
if [[ "$AHEAD" != "0" ]]; then
  echo "→ Pushing to GitHub (${BRANCH})..."
  git push origin "$BRANCH"
else
  echo "→ GitHub already up to date"
fi

echo ""
echo "→ Deploying on server ($SERVER)..."
echo ""

ssh -o ConnectTimeout=15 "$SERVER" "APP_DIR='$APP_DIR' PM2_NAME='$PM2_NAME' BUILD_CLIENT='$BUILD_CLIENT' bash -s" <<'REMOTE'
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/Canzey-AdminPanel}"
PM2_NAME="${PM2_NAME:-canzey-backend}"
BUILD_CLIENT="${BUILD_CLIENT:-0}"

cd "$APP_DIR"
echo "  git pull..."
git pull origin main

cd "$APP_DIR/server"
echo "  npm install..."
npm install --omit=dev

# PM2 sometimes runs from project root — ensure .env is found
if [[ -f .env ]]; then
  cp .env "$APP_DIR/.env"
fi

echo "  pm2 restart..."
pm2 restart "$PM2_NAME" --update-env 2>/dev/null || pm2 start server.js --name "$PM2_NAME"
pm2 save

if [[ "$BUILD_CLIENT" == "1" ]]; then
  echo "  building frontend..."
  cd "$APP_DIR/client"
  echo "VITE_API_URL=https://admin.canzey.com" > .env
  npm install
  npm run build
  cp -r dist/* /home/canzey/admin.canzey.com/
  chown -R canzey:canzey /home/canzey/admin.canzey.com/
fi

echo ""
pm2 status
REMOTE

echo ""
echo "✅ Deploy complete!"
echo ""
echo "Test ZMC: Admin → Testing → Sandbox → Test ZMC Connection"
echo ""
