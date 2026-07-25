#!/usr/bin/env bash
# Ensure a Playwright-MATCHED browser is running for the Amazon scrape.
#
# Why this exists: the old flow attached (connectOverCDP) to the user's real
# Chrome/Canary on :9222. Chrome auto-updates ahead of Playwright's supported
# CDP protocol (e.g. Canary 151 vs Playwright's Chromium 149) and the attach
# hangs forever (rc=4). Fix: run Playwright's OWN bundled "Chrome for Testing"
# (exactly version-matched, never drifts) on :9333 with a dedicated, persistent
# profile that stays logged into Amazon. Idempotent: reuses a healthy instance.
#
# Usage:  bash ensure-amazon-browser.sh        # launch/reuse, print status
#         CDP_PORT=9333 bash ensure-amazon-browser.sh
set -euo pipefail
cd "$(dirname "$0")"

CDP_PORT="${CDP_PORT:-9333}"
PROFILE="${AMAZON_PROFILE:-$HOME/.amazon-scrape-profile}"
URL="http://localhost:${CDP_PORT}"

healthy() {
  local v; v=$(curl -s -m 4 "${URL}/json/version" 2>/dev/null) || return 1
  [ -n "$v" ] && [ "$(echo "$v" | jq -r '.webSocketDebuggerUrl // "" | length>0')" = "true" ]
}

if healthy; then
  echo "✓ matched browser already up on :${CDP_PORT} ($(curl -s -m4 ${URL}/json/version | jq -r .Browser))"
else
  EXE=$(node -e "import('playwright-core').then(p=>console.log(p.chromium.executablePath()))" 2>/dev/null)
  if [ ! -e "$EXE" ]; then
    echo "Bundled chromium missing — installing..." >&2
    npx -y playwright@"$(jq -r '.version' node_modules/playwright-core/package.json)" install chromium >&2
    EXE=$(node -e "import('playwright-core').then(p=>console.log(p.chromium.executablePath()))" 2>/dev/null)
  fi
  mkdir -p "$PROFILE"
  echo "Launching $("$EXE" --version) on :${CDP_PORT} (profile: $PROFILE)..."
  "$EXE" --user-data-dir="$PROFILE" --remote-debugging-port="${CDP_PORT}" \
         --no-first-run --no-default-browser-check \
         "https://www.amazon.com/cpe/yourpayments/transactions" \
         >/tmp/amazon-cft.log 2>&1 &
  for i in $(seq 1 20); do sleep 1; healthy && break; done
  healthy && echo "✓ launched on :${CDP_PORT}" || { echo "✗ failed to come up; see /tmp/amazon-cft.log" >&2; exit 1; }
fi

# Report Amazon login state (best-effort): is the transactions page behind a sign-in wall?
SIGNED_IN=$(curl -s -m4 "${URL}/json" 2>/dev/null | jq -r '[.[]|select(.type=="page")|.url] | map(select(test("signin|ap/signin";"i"))) | length==0' 2>/dev/null || echo "unknown")
if [ "$SIGNED_IN" = "true" ]; then
  echo "  login: no sign-in wall detected (likely logged in)"
else
  echo "  login: ⚠ sign-in page open — log into Amazon in the Chrome-for-Testing window, then re-run the scrape"
fi
echo "  CDP_URL=${URL}  (export this for scrape/lookup, or they default to it)"
