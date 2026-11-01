# PureBazar deployment guide (step by step)

This guide installs PureBazar on one server using Docker. No programming is needed. Copy each command exactly.

## What you need
- A computer or server (Ubuntu Linux recommended) with internet and at least 4 GB RAM.
- Docker and Docker Compose installed. On Ubuntu: `sudo apt install docker.io docker-compose-v2`
  (Windows/Mac: install "Docker Desktop" from docker.com and open it).
- The PureBazar folder copied onto the server.

## 1. Set your settings
1. Open a terminal in the PureBazar folder.
2. Copy the settings file: `cp .env.example .env`
3. Open `.env` in a text editor (`nano .env`) and change:
   - `JWT_SECRET` - type a long random text, 32 or more characters. Keep it secret. Never share it.
   - `PUBLIC_URL` - the address people type in the browser, e.g. `http://192.168.1.10` or `https://shop.example.com`.
4. Save the file.

## 2. Start the system
```
docker compose up -d --build
```
The first run takes several minutes. When it ends, check everything is running:
```
docker compose ps
```
Each line should say `running` (or `healthy`).

## 3. Check it is healthy
```
curl http://localhost/api/health
```
You should see `{"status":"ok","db":"connected"}`. Then open the `PUBLIC_URL` address in a browser; the login page should appear.

First-time only, create the default roles:
```
docker compose exec backend node seeders/seedRoles.js
```

## 4. Daily automatic backup
The `backup` service already runs: it makes one backup when the system starts and then every 24 hours.
Backups are files in the `backups` folder (named like `purebazar-2026-11-01T02-00-00-000Z.ndjson.gz`).
Backups older than 14 days are deleted automatically (change `BACKUP_KEEP_DAYS` in `.env`).

Check it worked: `ls -lh backups`  and  `docker compose logs backup`

**Important:** copy the `backups` folder to another computer or USB drive regularly. A backup on the same server is lost if the server is lost.

Make a backup right now:
```
docker compose exec backup node scripts/backupDb.js
```

## 5. Restore a backup
Always practise restoring into a test database first, to prove the backup is good.

**Test restore (safe - does not touch your live data):**
```
docker compose exec backup node scripts/restoreDb.js /backups/<FILE-NAME> mongodb://mongo:27017/purebazar_restore_test
```
Replace `<FILE-NAME>` with a file from `ls backups`. The end of the output must say `RESULT: all counts match`. Each collection line must start with `OK`.

**Real restore (after a disaster; this REPLACES live data):**
1. Stop the app: `docker compose stop backend frontend nginx`
2. Restore: `docker compose exec backup node scripts/restoreDb.js /backups/<FILE-NAME> mongodb://mongo:27017/purebazar --drop`
3. Confirm `RESULT: all counts match`.
4. Start the app: `docker compose start backend frontend nginx`

Uploaded documents (vendor KYB files, expense attachments) are stored separately in the Docker volume `uploads_data` and are not part of the database backup.

## 6. Everyday commands
| Task | Command |
|---|---|
| See status | `docker compose ps` |
| See errors | `docker compose logs --tail 100 backend` |
| Stop | `docker compose down` (data is kept) |
| Update after new code | `docker compose up -d --build` |

Never run `docker compose down -v`: the `-v` deletes all data.

## 7. HTTPS (recommended on the internet)
Put the server behind a certificate provider (for example Cloudflare, or Certbot on the host with nginx forwarding to port `HTTP_PORT`). Then set `PUBLIC_URL` to the `https://` address and run `docker compose up -d`.

## Problems
- `JWT_SECRET` error on start: you did not fill `.env` (step 1).
- Health check says `disconnected`: wait one minute and retry; if still failing, `docker compose logs mongo backend`.
- Port 80 in use: set `HTTP_PORT=8080` in `.env`, then use `http://localhost:8080`.

## Without Docker (backup only)
From the `backend` folder, with `MONGODB_URI` set in `backend/.env`:
`npm run backup` and `npm run restore -- <file> <target-uri>`. Schedule `npm run backup` daily with cron (Linux) or Task Scheduler (Windows).
