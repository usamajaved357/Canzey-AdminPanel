# Deploy setup (one-time)

## What gets deployed

Push to `main` on GitHub → server runs `git pull` → `npm install` → `pm2 restart`.

`.env` on the server is **never** overwritten by git (secrets stay on VPS only).

---

## Option A — Deploy from Mac / Cursor terminal (SSH)

Same commands as WHM Terminal, from your Mac:

```bash
ssh root@199.231.184.194
# then run deploy steps, or use the helper script after pushing it:
```

After the deploy scripts are in the repo:

```bash
cd /Users/ibneyousaf/SwitchToFuture/React/Canzey-AdminPanel
chmod +x scripts/deploy-from-mac.sh
./scripts/deploy-from-mac.sh
```

With frontend rebuild:

```bash
BUILD_CLIENT=1 ./scripts/deploy-from-mac.sh
```

---

## Option B — Auto deploy on every `git push` (GitHub Actions)

### 1. One-time: SSH key for GitHub → server

On your Mac:

```bash
ssh-keygen -t ed25519 -C "github-deploy-canzey" -f ~/.ssh/canzey_deploy -N ""
ssh-copy-id -i ~/.ssh/canzey_deploy.pub root@199.231.184.194
```

### 2. Add GitHub repo secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → New secret:

| Secret | Value |
|--------|--------|
| `DEPLOY_HOST` | `199.231.184.194` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_SSH_KEY` | contents of `~/.ssh/canzey_deploy` (private key) |

### 3. Push workflow file

Commit `.github/workflows/deploy.yml` — every push to `main` deploys automatically.

---

## Pending code fix (`.env` loading)

These files fix “credentials incomplete” when PM2 runs from the wrong folder:

- `server/config/loadEnv.js` (new)
- `server/server.js`
- `server/services/zmcCargoService.js`

**Push to GitHub**, then deploy (manual SSH or GitHub Action).

**Quick fix without code push** (on server only):

```bash
cp /var/www/Canzey-AdminPanel/server/.env /var/www/Canzey-AdminPanel/.env
pm2 restart canzey-backend --update-env
```
