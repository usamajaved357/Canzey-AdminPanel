#!/usr/bin/env bash
# Run ON the server after git pull (or called by GitHub Actions / SSH from Mac)
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/Canzey-AdminPanel}"
PM2_NAME="${PM2_NAME:-canzey-backend}"
BUILD_CLIENT="${BUILD_CLIENT:-0}"

echo "==> Deploying Canzey Admin Panel"
cd "$APP_DIR"

echo "==> Pull latest code"
git pull origin main

echo "==> Install server dependencies"
cd "$APP_DIR/server"
npm install --omit=dev

# Ensure PM2 loads server/.env even if cwd is project root
if [[ -f .env && ! -f "$APP_DIR/.env" ]]; then
  cp .env "$APP_DIR/.env"
fi

echo "==> Restart backend"
pm2 restart "$PM2_NAME" --update-env || pm2 start server.js --name "$PM2_NAME"
pm2 save

if [[ "$BUILD_CLIENT" == "1" ]]; then
  echo "==> Build & publish frontend"
  cd "$APP_DIR/client"
  echo "VITE_API_URL=https://admin.canzey.com" > .env
  npm install
  npm run build
  cp -r dist/* /home/canzey/admin.canzey.com/
  chown -R canzey:canzey /home/canzey/admin.canzey.com/
fi

echo "==> Done"
pm2 status
