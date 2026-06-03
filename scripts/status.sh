#!/bin/bash
# ============================================================
# Hydro ??????
# ??: bash scripts/status.sh
# ============================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

check() {
    if [ "$1" -eq 0 ]; then
        echo -e "  ${GREEN}[OK]${NC} $2"
    else
        echo -e "  ${RED}[FAIL]${NC} $2"
    fi
}

echo "========================================"
echo " Hydro ??????"
echo " ??: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

echo ""
echo "--- ???? ---"

pgrep -x mongod > /dev/null 2>&1
check $? "MongoDB (mongod)"

echo ""
echo "--- PM2 ?? ---"
pm2 status 2>/dev/null || echo -e "  ${RED}[FAIL]${NC} PM2 not available"

echo ""
echo "--- HTTP ?? ---"

HTTP=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8888/ 2>/dev/null || echo "000")
if [ "$HTTP" = "200" ]; then
    echo -e "  ${GREEN}[OK]${NC} Hydro :8888 -> HTTP $HTTP"
else
    echo -e "  ${RED}[FAIL]${NC} Hydro :8888 -> HTTP $HTTP"
fi

SANDBOX=$(curl -s http://localhost:5050/version 2>/dev/null)
if echo "$SANDBOX" | grep -q buildVersion; then
    VER=$(echo "$SANDBOX" | grep -o '"buildVersion":"[^"]*"' | cut -d'"' -f4)
    echo -e "  ${GREEN}[OK]${NC} Sandbox :5050 -> $VER"
else
    echo -e "  ${RED}[FAIL]${NC} Sandbox :5050"
fi

echo ""
echo "--- ???? ---"
ADDON_FILE="$HOME/.hydro/addon.json"
if [ -f "$ADDON_FILE" ]; then
    echo "  addon.json: $(cat "$ADDON_FILE" | python3 -c "import sys,json; print(len(json.load(sys.stdin)), 'plugins')" 2>/dev/null || echo 'parse error')"
    cat "$ADDON_FILE" | python3 -c "
import sys,json
addons=json.load(sys.stdin)
for a in addons:
    name=a.split('/')[-1]
    print(f'    - {name}')
" 2>/dev/null || cat "$ADDON_FILE"
else
    echo -e "  ${RED}[FAIL]${NC} addon.json not found"
fi

echo ""
echo "--- ?????? ---"

VIDEO=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8888/video 2>/dev/null || echo "000")
if [ "$VIDEO" = "200" ]; then
    echo -e "  ${GREEN}[OK]${NC} /video -> $VIDEO"
else
    echo -e "  ${YELLOW}[WARN]${NC} /video -> $VIDEO"
fi

echo ""
echo "========================================"
echo " ????"
echo "========================================"
