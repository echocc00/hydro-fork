#!/bin/bash
# deploy-verify.sh ? ??????????
# ??: bash scripts/deploy-verify.sh
# ???? FAIL ? exit 1???? CI

set -e

FAILURES=0
check() {
    local name="$1"
    shift
    if "$@" > /dev/null 2>&1; then
        echo "  [PASS] $name"
    else
        echo "  [FAIL] $name"
        FAILURES=$((FAILURES + 1))
    fi
}

echo "=== js001 ??????? ==="
echo ""

# --- 1. ???? ---
echo "--- ???? ---"
check "mongod running"       pgrep -f mongod
check "hydro-backend pm2"    pm2 status | grep -q hydro-backend

# --- 2. ???? ---
echo "--- ???? ---"
check "config.json exists"   test -f ~/.hydro/config.json
check "addon.json exists"    test -f ~/.hydro/addon.json

# --- 3. ???? ---
echo "--- ???? ---"
check "ui-next built"        test -f ~/Hydro/packages/ui-next/public/index.html
check "ui-default built"     test -f ~/Hydro/packages/ui-default/public/index.html

# --- 4. ???? ---
echo "--- ???? ---"
check "HTTP 200 on :8888"    test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8888/)" = "200"
check "HTTP 200 /login"      test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8888/login)" = "200"
check "HTTP 200 /p"          test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8888/p)" = "200"

# --- 5. ???? (????) ---
echo "--- ???? ---"
check "sandbox :5050"        curl -s http://localhost:5050/version | grep -q buildVersion 2>/dev/null || true
check "hydrojudge online"    pm2 status | grep hydrojudge | grep -q online 2>/dev/null || true

# --- 6. ???????? ---
echo "--- ???? ---"
DARK_COUNT=$(grep -c 'theme--dark' ~/Hydro/packages/ui-default/public/theme-*.css 2>/dev/null || echo 0)
echo "  [INFO] theme--dark count: $DARK_COUNT"

# --- 7. ???? (??) ---
echo "--- ???? ---"
# ????????????? UTF-8
for f in ~/Hydro/packages/ui-default/templates/*.html; do
    if [ -f "$f" ]; then
        ENC=$(file --mime-encoding "$f" 2>/dev/null | awk '{print $NF}')
        if [ "$ENC" != "utf-8" ] && [ "$ENC" != "us-ascii" ]; then
            echo "  [FAIL] $f encoding: $ENC"
            FAILURES=$((FAILURES + 1))
        fi
    fi
done
echo "  [INFO] encoding spot-check done"

# --- ?? ---
echo ""
echo "=== ??: $FAILURES ??? ==="

if [ "$FAILURES" -gt 0 ]; then
    echo "????? [FAIL] ??????"
    exit 1
else
    echo "???????"
    exit 0
fi
