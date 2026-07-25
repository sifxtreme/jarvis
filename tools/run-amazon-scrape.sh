#!/usr/bin/env bash
# run-amazon-scrape.sh — resilient launcher + 30s watchdog for the Amazon scrape.
#
# Why this exists: the scrape is a weekly task that MUST NOT silently hang.
# Piping a long scrape through `tail` buffers all output, so a 0%-CPU hang
# looks identical to healthy work. This wrapper instead:
#   - launches the scraper to a logfile (NEVER a pipe — no buffering blindness)
#   - polls every 30s: process alive? log growing? CPU non-zero? status phase?
#   - kills + prints a precise diagnosis if it stalls, flatlines, or hits a
#     login wall; propagates the scraper's exit code otherwise
#
# Exit codes (mirror scrape-amazon-transactions.mjs):
#   0 ok | 2 watchdog/stall | 3 Amazon login wall | 4 CDP connect | 1 other
set -uo pipefail
cd "$(dirname "$0")"

# Full-history mode: `./run-amazon-scrape.sh --all` (or SCRAPE_ALL=1) walks
# the entire Amazon transaction history into amazon_transactions.json so future
# matching never needs to re-scrape. It paginates hundreds of POST pages, so
# the wrapper ceiling is raised accordingly.
if [ "${1:-}" = "--all" ] || [ "${SCRAPE_ALL:-}" = "1" ]; then
  export SCRAPE_ALL=1
  MODE="FULL HISTORY"
  HARD_DEADLINE=${WRAPPER_DEADLINE:-3300}   # 55 min ceiling
else
  MODE="recent"
  HARD_DEADLINE=${WRAPPER_DEADLINE:-420}    # 7 min ceiling
fi

LOG="${SCRAPE_LOG:-/tmp/amazon-scrape.log}"
STATUS_FILE="./amazon_scrape_status.json"
POLL_SECS=30
STALL_LIMIT=3        # consecutive polls with no log growth AND ~0% CPU => stalled

: > "$LOG"
rm -f "$STATUS_FILE"

# CDP target: Playwright's bundled, version-MATCHED Chrome-for-Testing on :9333
# (NOT the user's real Chrome/Canary — that drifts ahead of Playwright's CDP and
#  the attach hangs forever, rc=4). ensure-amazon-browser.sh launches/reuses it
# with a persistent profile that stays logged into Amazon.
CDP_PORT="${CDP_PORT:-9333}"
export CDP_URL="http://localhost:${CDP_PORT}"

# 1. Pre-flight: ensure the matched browser is up (idempotent; installs if needed).
if ! bash ensure-amazon-browser.sh; then
  echo "PREFLIGHT FAIL: could not bring up the matched browser on :${CDP_PORT}."
  exit 4
fi

# 2. Pre-flight: not sitting on an Amazon sign-in page (session expired).
if curl -s -m 5 "${CDP_URL}/json" 2>/dev/null | grep -Eqi 'ap/signin|/ap/mfa|signin\?'; then
  echo "PREFLIGHT WARN: an Amazon sign-in URL is open — session expired."
  echo "  Log into Amazon in the Chrome-for-Testing window (profile \$HOME/.amazon-scrape-profile), then re-run."
  exit 3
fi

# 4. Launch the scraper detached, output -> logfile (no pipe buffering).
node scrape-amazon-transactions.mjs >>"$LOG" 2>&1 &
SCRAPE_PID=$!
echo "Launched scrape (pid $SCRAPE_PID) [$MODE]. Log: $LOG | poll ${POLL_SECS}s | ceiling ${HARD_DEADLINE}s"

start=$(date +%s)
last_size=0
stall_count=0

while kill -0 "$SCRAPE_PID" 2>/dev/null; do
  sleep "$POLL_SECS"

  now=$(date +%s); elapsed=$(( now - start ))
  size=$(wc -c <"$LOG" 2>/dev/null | tr -d ' ')
  cpu=$(ps -o %cpu= -p "$SCRAPE_PID" 2>/dev/null | tr -d ' ' | cut -d. -f1)
  cpu=${cpu:-0}
  phase=$(grep -o '"phase": *"[^"]*"' "$STATUS_FILE" 2>/dev/null | tail -1 | cut -d'"' -f4)
  echo "  [+${elapsed}s] phase=${phase:-?} log=${size}B cpu=${cpu}% stall=${stall_count}/${STALL_LIMIT}"

  # Login wall surfaced via the scraper's status file -> fail fast, actionable.
  if [ "$phase" = "login_wall" ]; then
    echo "DIAGNOSIS: Amazon session dropped mid-run (login wall). Re-auth in Canary, re-run."
    kill "$SCRAPE_PID" 2>/dev/null; wait "$SCRAPE_PID" 2>/dev/null
    exit 3
  fi

  # Stall = log not growing AND CPU flatlined, for STALL_LIMIT consecutive polls.
  if [ "$size" -le "$last_size" ] && [ "$cpu" -le 1 ]; then
    stall_count=$(( stall_count + 1 ))
  else
    stall_count=0
  fi
  last_size=$size

  if [ "$stall_count" -ge "$STALL_LIMIT" ]; then
    echo "DIAGNOSIS: scrape hung — no output + ~0% CPU for $(( STALL_LIMIT * POLL_SECS ))s (last phase: ${phase:-unknown})."
    echo "  Most likely a silent Amazon login redirect or a dead CDP page. Killing."
    kill "$SCRAPE_PID" 2>/dev/null; wait "$SCRAPE_PID" 2>/dev/null
    tail -15 "$LOG"
    exit 2
  fi

  if [ "$elapsed" -ge "$HARD_DEADLINE" ]; then
    echo "DIAGNOSIS: wrapper hard deadline ${HARD_DEADLINE}s exceeded. Killing."
    kill "$SCRAPE_PID" 2>/dev/null; wait "$SCRAPE_PID" 2>/dev/null
    tail -15 "$LOG"
    exit 2
  fi
done

wait "$SCRAPE_PID"; rc=$?
echo "Scrape exited rc=$rc"
tail -8 "$LOG"
exit "$rc"
