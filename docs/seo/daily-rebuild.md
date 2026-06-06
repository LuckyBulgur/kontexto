# Daily Rebuild

The static export must be regenerated nightly so:

- Archive pages include yesterday's (newly revealed) word.
- The sitemap `lastmod` stays current.
- The build-time `AggregateRating` reflects today's ratings.

## Schedule

Fire at **00:05 server-local time** — five minutes after midnight, when the new
daily word is already persisted in the backend database and `/api/reveal?game=N`
returns the fresh answer.

### crontab (simplest)

```crontab
5 0 * * * /home/ugura/kontexto/scripts/daily-rebuild.sh >> /var/log/kontexto-rebuild.log 2>&1
```

Install with `crontab -e` on the server. Ensure the user running the cron job
has write access to `/srv/kontexto/out/` and that `pnpm` is in its `PATH`
(set `PATH=/usr/local/bin:/usr/bin:/bin` at the top of the crontab if needed).

### systemd timer (recommended for better logging + dependency ordering)

**`/etc/systemd/system/kontexto-rebuild.service`**

```ini
[Unit]
Description=Kontexto daily static rebuild
After=network.target

[Service]
Type=oneshot
User=kontexto
ExecStart=/home/ugura/kontexto/scripts/daily-rebuild.sh
StandardOutput=journal
StandardError=journal
```

**`/etc/systemd/system/kontexto-rebuild.timer`**

```ini
[Unit]
Description=Trigger Kontexto daily rebuild at 00:05

[Timer]
OnCalendar=*-*-* 00:05:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable: `systemctl enable --now kontexto-rebuild.timer`

Inspect logs: `journalctl -u kontexto-rebuild.service -n 50`

## Networking requirement

The script must run **where the FastAPI backend is reachable** at
`KONTEXTO_BUILD_API_BASE` (default `http://127.0.0.1:8000/api`).

### Docker variant

If the frontend build runs in a container, share the Docker network with the
API container so the build can reach the backend:

```bash
docker run --rm \
  --network kontexto_net \
  -e KONTEXTO_BUILD_API_BASE=http://api:8000/api \
  -e KONTEXTO_REQUIRE_ARCHIVE=1 \
  -e KONTEXTO_REQUIRE_IMPRESSUM=1 \
  -v /srv/kontexto/out:/app/frontend/out \
  kontexto-build:latest \
  bash scripts/daily-rebuild.sh
```

## Fail-fast guards

| Variable | Effect |
|---|---|
| `KONTEXTO_REQUIRE_ARCHIVE=1` | Build fails if the archive API is unreachable or returns errors — a broken archive never ships. |
| `KONTEXTO_REQUIRE_IMPRESSUM=1` | Build fails until `frontend/lib/legal.ts` is populated with real address data. **Remove this guard only after legal.ts is filled before public launch.** |

Both guards are set unconditionally in `scripts/daily-rebuild.sh`.

## Manual trigger

```bash
KONTEXTO_BUILD_API_BASE=http://127.0.0.1:8000/api bash /home/ugura/kontexto/scripts/daily-rebuild.sh
```
