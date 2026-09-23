#!/usr/bin/env python3
"""Print Adcash publisher statistics for kontexto.de from the Reporting API v2.

The API key never lives in the repository. It is read from the environment
variable ADCASH_API_KEY, or from ~/.config/kontexto/adcash.env (one line,
ADCASH_API_KEY=...), which is created outside the working tree on purpose.

API reference: https://support.adcash.com/en/articles/424-publisher-reporting-api-v-2
  POST /api/v2/auth/token      exchanges the API key for a bearer token (15 min)
  GET  /api/v2/publishers/reports   earnings, impressions, clicks, unique users
  GET  /api/v2/publishers/balance   current account balance
Rate limit: 60 requests per minute per token; a 429 is retried with backoff.

Usage:
  python scripts/adcash-report.py                  # last 7 days, by zone and date
  python scripts/adcash-report.py --days 30 --group-by zone
  python scripts/adcash-report.py --group-by country --json
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

BASE_URL = "https://adcash.myadcash.com/api/v2"
ENV_FILE = Path.home() / ".config" / "kontexto" / "adcash.env"
MAX_HISTORY_DAYS = 120
ZONE_NAMES = {
    "12211730": "rail left 160x600",
    "12211722": "rail right 160x600",
    "12211714": "bottom bar 300x100",
    "l8rhgb60kc": "autotag (verification only)",
}
GROUP_VALUES = {"zone", "site", "country", "date", "month", "week", "device_type", "sub1", "sub2"}


def read_api_key() -> str:
    key = os.environ.get("ADCASH_API_KEY", "").strip()
    if key:
        return key
    if ENV_FILE.is_file():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            name, sep, value = line.partition("=")
            if sep and name.strip() == "ADCASH_API_KEY" and value.strip():
                return value.strip()
    sys.exit(f"No API key: set ADCASH_API_KEY or write it to {ENV_FILE}")


def request(method: str, path: str, *, token: str | None = None, body: dict[str, Any] | None = None,
            query: dict[str, str] | None = None) -> dict[str, Any]:
    url = f"{BASE_URL}{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query, safe=',[]')}"
    data = json.dumps(body).encode() if body is not None else None
    # Cloudflare in front of the API refuses the default Python-urllib signature
    # (error 1010), so the script names itself.
    headers = {"Accept": "application/json", "User-Agent": "kontexto-adcash-report/1.0 (+https://kontexto.de)"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    delay = 2.0
    for attempt in range(4):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as err:
            if err.code == 429 and attempt < 3:
                time.sleep(delay)
                delay *= 2
                continue
            detail = err.read().decode("utf-8", errors="replace")[:500]
            sys.exit(f"{method} {path} failed with HTTP {err.code}: {detail}")
        except urllib.error.URLError as err:
            sys.exit(f"{method} {path} failed: {err.reason} (a DNS ad filter blocking myadcash.com?)")
    sys.exit(f"{method} {path} kept hitting the rate limit")


def access_token(api_key: str) -> str:
    payload = request("POST", "/auth/token", body={"api_token": api_key})
    token = payload.get("data", {}).get("access_token")
    if not isinstance(token, str) or not token:
        sys.exit("The token endpoint answered without an access_token")
    return token


def zone_label(row: dict[str, Any]) -> str:
    """Adcash reports child zones it runs under a parent (field `parent_zone`) as rows of their own."""
    zone = str(row.get("zone"))
    parent = row.get("parent_zone")
    if parent:
        return f"{ZONE_NAMES.get(str(parent), parent)}, sub-zone {zone}"
    return ZONE_NAMES.get(zone, zone)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--days", type=int, default=7, help="reporting window ending today (1 to 120)")
    parser.add_argument("--group-by", default="zone,date", help="comma-separated, e.g. zone,date or country")
    parser.add_argument("--json", action="store_true", help="print the raw API response")
    args = parser.parse_args()

    if not 1 <= args.days <= MAX_HISTORY_DAYS:
        sys.exit(f"--days must be between 1 and {MAX_HISTORY_DAYS}")
    groups = [g.strip() for g in args.group_by.split(",") if g.strip()]
    unknown = sorted(set(groups) - GROUP_VALUES)
    if not groups or unknown:
        sys.exit(f"--group-by accepts {', '.join(sorted(GROUP_VALUES))}; got {', '.join(unknown) or 'nothing'}")

    token = access_token(read_api_key())
    end = dt.date.today()
    start = end - dt.timedelta(days=args.days - 1)
    report = request("GET", "/publishers/reports", token=token, query={
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "group_by": ",".join(groups),
    })
    balance = request("GET", "/publishers/balance", token=token)

    if args.json:
        print(json.dumps({"report": report, "balance": balance}, indent=2))
        return

    meta = report.get("meta", {})
    currency = meta.get("currency", "")
    rows = report.get("data", {}).get("rows", [])
    print(f"Adcash {start} to {end}, grouped by {', '.join(groups)}, times in {meta.get('timezone', '?')}")
    if not rows:
        print("No rows: no impression has been counted in this window yet.")
    total = 0.0
    for row in rows:
        label = " / ".join(zone_label(row) if g == "zone" else str(row.get(g)) for g in groups)
        earnings = float(row.get("earnings") or 0)
        total += earnings
        print(
            f"  {label:<42} {earnings:>9.2f} {currency}  users {row.get('unique_users', 0):>7}"
            f"  clicks {row.get('clicks', 0):>5}  eCPM {row.get('unique_users_ecpm', '-')}"
        )
    print(f"Total {total:.2f} {currency}")
    bal = balance.get("data", {})
    print(f"Balance {bal.get('balance', '?')} {bal.get('currency', '')} (payout from 100 EUR)")


if __name__ == "__main__":
    main()
