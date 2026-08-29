#!/usr/bin/env bash
# Run from your Mac — SSH into VPS and deploy latest main
set -euo pipefail

SERVER_HOST="${SERVER_HOST:-root@199.231.184.194}"
APP_DIR="${APP_DIR:-/var/www/Canzey-AdminPanel}"
BUILD_CLIENT="${BUILD_CLIENT:-0}"

echo "==> Deploying to $SERVER_HOST"

ssh "$SERVER_HOST" "APP_DIR='$APP_DIR' BUILD_CLIENT='$BUILD_CLIENT' bash -s" <<'EOF'
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/Canzey-AdminPanel}"
PM2_NAME="${PM2_NAME:-canzey-backend}"
BUILD_CLIENT="${BUILD_CLIENT:-0}"

cd "$APP_DIR"
git pull origin main

cd "$APP_DIR/server"
npm install --omit=dev

if [[ -f .env && ! -f "$APP_DIR/.env" ]]; then
  cp .env "$APP_DIR/.env"
fi

pm2 restart "$PM2_NAME" --update-env || pm2 start server.js --name "$PM2_NAME"
pm2 save

if [[ "$BUILD_CLIENT" == "1" ]]; then
  cd "$APP_DIR/client"
  echo "VITE_API_URL=https://admin.canzey.com" > .env
  npm install
  npm run build
  cp -r dist/* /home/canzey/admin.canzey.com/
  chown -R canzey:canzey /home/canzey/admin.canzey.com/
fi

pm2 status
echo "Deploy complete"
EOF
