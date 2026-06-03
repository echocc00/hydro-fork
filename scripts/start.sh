#!/bin/bash
# ============================================================
# Hydro ?????? - ???????????
# ??: bash scripts/start.sh
# ============================================================
set -e

HYDRO_DIR="$HOME/Hydro"
NODE_BIN="$HOME/node-v22.14.0-linux-x64/bin"
export PATH="$NODE_BIN:$PATH"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo "========================================"
echo " Hydro ??????"
echo "========================================"

# ---- 0. ???? ----
echo ""
echo ">>> [0/4] ????..."

if pgrep -x mongod > /dev/null; then
    echo -e "${GREEN}[OK]${NC} MongoDB is running"
else
    echo -e "${YELLOW}[WARN]${NC} MongoDB not running, attempting systemctl start..."
    sudo systemctl start mongod 2>/dev/null || {
        echo -e "${RED}[FATAL]${NC} Cannot start MongoDB. Abort."
        exit 1
    }
    sleep 2
fi

if [ -x "$NODE_BIN/node" ]; then
    echo -e "${GREEN}[OK]${NC} Node.js: $($NODE_BIN/node --version)"
else
    echo -e "${RED}[FATAL]${NC} Node.js not found at $NODE_BIN"
    exit 1
fi

if command -v pm2 &>/dev/null; then
    echo -e "${GREEN}[OK]${NC} PM2: $(pm2 --version)"
else
    echo -e "${RED}[FATAL]${NC} PM2 not found"
    exit 1
fi

# ---- 1. ?? Sandbox ----
echo ""
echo ">>> [1/4] ?? Sandbox (go-judge)..."

if pm2 show sandbox 2>/dev/null | grep -q 'online'; then
    echo -e "${GREEN}[OK]${NC} Sandbox already running"
else
    if [ ! -f "$HOME/bin/sandbox" ]; then
        echo -e "${YELLOW}[WARN]${NC} sandbox binary not found, running setup-judge.sh..."
        bash "$HYDRO_DIR/scripts/setup-judge.sh"
    fi
    pm2 start "$HOME/bin/sandbox" --name sandbox -- \
        -mount-conf "$HOME/.hydro/mount.yaml" \
        -http-addr 0.0.0.0:5050 \
        -release
fi

for i in $(seq 1 10); do
    if curl -s http://localhost:5050/version 2>/dev/null | grep -q buildVersion; then
        echo -e "${GREEN}[OK]${NC} Sandbox ready on :5050"
        break
    fi
    [ "$i" -eq 10 ] && { echo -e "${RED}[FATAL]${NC} Sandbox failed to start"; exit 1; }
    sleep 1
done

# ---- 2. ?? addon.json ----
echo ""
echo ">>> [2/4] ??????..."

ADDON_FILE="$HOME/.hydro/addon.json"
REQUIRED_ADDONS=(
    "/home/debian/Hydro/packages/ui-default"
    "/home/debian/Hydro/packages/ai-analyzer"
    "/home/debian/Hydro/packages/video"
)

if [ ! -f "$ADDON_FILE" ]; then
    echo "[]" > "$ADDON_FILE"
fi

CURRENT=$(cat "$ADDON_FILE")
MODIFIED=false
for addon in "${REQUIRED_ADDONS[@]}"; do
    if ! echo "$CURRENT" | grep -q "$addon"; then
        echo "  Adding: $addon"
        MODIFIED=true
    fi
done

if [ "$MODIFIED" = true ]; then
    NEW_JSON="["
    FIRST=true
    for addon in "${REQUIRED_ADDONS[@]}"; do
        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            NEW_JSON+=","
        fi
        NEW_JSON+="\n    \"$addon\""
    done
    NEW_JSON+="\n]"
    echo -e "$NEW_JSON" > "$ADDON_FILE"
    echo -e "${YELLOW}[INFO]${NC} addon.json updated"
else
    echo -e "${GREEN}[OK]${NC} All plugins registered"
fi

# ---- 3. ?? hydro-backend ----
echo ""
echo ">>> [3/4] ?? hydro-backend..."

if [ ! -f "$HYDRO_DIR/packages/hydrooj/bin/hydrooj.js" ]; then
    echo -e "${YELLOW}[WARN]${NC} hydrooj.js not found, running build..."
    cd "$HYDRO_DIR" && yarn build
fi

if pm2 show hydro-backend 2>/dev/null | grep -q 'online'; then
    echo -e "${GREEN}[OK]${NC} hydro-backend already running"
else
    pm2 start "$HYDRO_DIR/packages/hydrooj/bin/hydrooj.js" --name hydro-backend
fi

for i in $(seq 1 20); do
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8888/ 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
        echo -e "${GREEN}[OK]${NC} Backend ready on :8888 (HTTP $HTTP_CODE)"
        break
    fi
    [ "$i" -eq 20 ] && { echo -e "${RED}[FATAL]${NC} Backend failed to start"; pm2 logs hydro-backend --lines 20 --nostream; exit 1; }
    sleep 2
done

# ---- 4. ?? hydrojudge ----
echo ""
echo ">>> [4/4] ?? hydrojudge..."

if pm2 show hydrojudge 2>/dev/null | grep -q 'online'; then
    echo -e "${GREEN}[OK]${NC} hydrojudge already running"
else
    JUDGE_BIN="$HYDRO_DIR/packages/hydrojudge/node_modules/.bin/hydrojudge"
    if [ ! -f "$JUDGE_BIN" ]; then
        echo -e "${YELLOW}[WARN]${NC} hydrojudge not built, compiling..."
        cd "$HYDRO_DIR" && yarn build
    fi
    pm2 start "$JUDGE_BIN" --name hydrojudge
    sleep 3
fi

# ---- ???? ----
echo ""
echo "========================================"
echo " ????"
echo "========================================"

check_svc() {
    if pm2 show "$1" 2>/dev/null | grep -q 'online'; then
        echo -e "  ${GREEN}[OK]${NC} $1"
    else
        echo -e "  ${RED}[FAIL]${NC} $1"
        return 1
    fi
}

FAILS=0
check_svc sandbox || FAILS=1
check_svc hydro-backend || FAILS=1
check_svc hydrojudge || FAILS=1

HTTP=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8888/ 2>/dev/null)
if [ "$HTTP" = "200" ]; then
    echo -e "  ${GREEN}[OK]${NC} HTTP :8888 -> $HTTP"
else
    echo -e "  ${RED}[FAIL]${NC} HTTP :8888 -> $HTTP"
    FAILS=1
fi

SANDBOX=$(curl -s http://localhost:5050/version 2>/dev/null | grep -c buildVersion)
if [ "$SANDBOX" -gt 0 ]; then
    echo -e "  ${GREEN}[OK]${NC} Sandbox :5050"
else
    echo -e "  ${RED}[FAIL]${NC} Sandbox :5050"
    FAILS=1
fi

echo ""
if [ "$FAILS" -eq 1 ]; then
    echo -e "${RED}??????????????:${NC}"
    echo "  pm2 logs --lines 30"
    exit 1
else
    echo -e "${GREEN}????????!${NC}"
    pm2 status
fi
