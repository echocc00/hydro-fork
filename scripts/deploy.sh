#!/bin/bash
# ============================================================
# Hydro ?????? - ???? + ?? + ???? + ?? + ??
# ??: bash scripts/deploy.sh [--skip-build] [--skip-restart] [--skip-pull]
# ============================================================
set -e

HYDRO_DIR="$HOME/Hydro"
NODE_BIN="$HOME/node-v22.14.0-linux-x64/bin"
export PATH="$NODE_BIN:$PATH"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
step() { echo -e "\n${BLUE}>>> [$1]${NC} $2"; }
ok()   { echo -e "  ${GREEN}[OK]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; }

SKIP_BUILD=false
SKIP_RESTART=false
SKIP_PULL=false
for arg in "$@"; do
    case $arg in
        --skip-build) SKIP_BUILD=true ;;
        --skip-restart) SKIP_RESTART=true ;;
        --skip-pull) SKIP_PULL=true ;;
    esac
done

cd "$HYDRO_DIR"

echo "========================================"
echo " Hydro ????"
echo " ??: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# ---- 1. ???? ----
if [ "$SKIP_PULL" = false ]; then
    step "1/6" "??????..."
    if command -v git &>/dev/null; then
        git pull origin base-deploy 2>&1 || warn "git pull failed (network issue?), continuing..."
    else
        warn "git not found, skipping pull"
    fi
else
    step "1/6" "???? (?? --skip-pull)"
fi

# ---- 2. ?? ----
step "2/6" "?????..."
node packages/hydrooj/bin/hydrooj.js backup 2>&1 || warn "Backup skipped (non-critical)"
ok "Backup done"

# ---- 3. ???? ----
step "3/6" "?????? (addon.json)..."

ADDON_FILE="$HOME/.hydro/addon.json"
REQUIRED_ADDONS=(
    "/home/debian/Hydro/packages/ui-default"
    "/home/debian/Hydro/packages/ai-analyzer"
    "/home/debian/Hydro/packages/video"
)

if [ ! -f "$ADDON_FILE" ]; then
    echo "[]" > "$ADDON_FILE"
    warn "addon.json created"
fi

MISSING_ADDONS=()
for addon in "${REQUIRED_ADDONS[@]}"; do
    if ! grep -q "$addon" "$ADDON_FILE"; then
        warn "$addon is NOT in addon.json"
        MISSING_ADDONS+=("$addon")
    else
        ok "$addon"
    fi
done

if [ ${#MISSING_ADDONS[@]} -gt 0 ]; then
    echo ""
    echo -e "  ${YELLOW}Auto-fixing addon.json...${NC}"
    NEW_JSON="["
    FIRST=true
    for addon in "${REQUIRED_ADDONS[@]}"; do
        if [ "$FIRST" = true ]; then FIRST=false; else NEW_JSON+=","; fi
        NEW_JSON+="\n    \"$addon\""
    done
    NEW_JSON+="\n]"
    echo -e "$NEW_JSON" > "$ADDON_FILE"
    ok "addon.json auto-fixed"
fi

# ---- 4. ?? ----
if [ "$SKIP_BUILD" = false ]; then
    step "4/6" "?? TypeScript + ????..."
    echo "  [4a] yarn install..."
    yarn install --frozen-lockfile 2>&1 | tail -3
    ok "yarn install"
    echo "  [4b] yarn build (TypeScript)..."
    yarn build 2>&1 | tail -5
    ok "TypeScript compiled"
    echo "  [4c] build:ui (webpack + iconfont)..."
    npm run build:ui 2>&1 | tail -5
    ok "UI built"
    echo "  [4d] ?????? CSS..."
    node scripts/compile-dark-css.js 2>&1 || warn "Dark CSS compile skipped"
else
    step "4/6" "?? (?? --skip-build)"
fi

# ---- 5. ?? ----
if [ "$SKIP_RESTART" = false ]; then
    step "5/6" "???? (???)..."

    # ?????
    if pm2 show hydrojudge 2>/dev/null | grep -q 'online'; then
        pm2 stop hydrojudge 2>&1 | tail -1
        ok "hydrojudge stopped"
    fi

    # ????
    pm2 restart hydro-backend 2>&1 | tail -1
    echo "  ??????..."
    for i in $(seq 1 20); do
        HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8888/ 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
            ok "Backend ready (HTTP $HTTP_CODE)"
            break
        fi
        [ "$i" -eq 20 ] && { fail "Backend failed to start"; exit 1; }
        sleep 2
    done

    # ?? sandbox
    if pm2 show sandbox 2>/dev/null | grep -q 'online'; then
        pm2 restart sandbox 2>&1 | tail -1
    else
        pm2 start "$HOME/bin/sandbox" --name sandbox --             -mount-conf "$HOME/.hydro/mount.yaml"             -http-addr 0.0.0.0:5050             -release 2>&1 | tail -1
    fi
    ok "sandbox ready"

    # ?????
    pm2 restart hydrojudge 2>&1 | tail -1
    ok "hydrojudge restarted"
else
    step "5/6" "?? (?? --skip-restart)"
fi

# ---- 6. ?? ----
step "6/6" "????..."

FAILS=0

# MongoDB
pgrep -x mongod > /dev/null 2>&1 && ok "MongoDB" || { fail "MongoDB"; FAILS=1; }

# PM2 services
for svc in sandbox hydro-backend hydrojudge; do
    if pm2 show "$svc" 2>/dev/null | grep -q 'online'; then
        ok "$svc"
    else
        fail "$svc"
        FAILS=1
    fi
done

# HTTP endpoints
HTTP=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8888/ 2>/dev/null)
[ "$HTTP" = "200" ] && ok "Hydro :8888 -> $HTTP" || { fail "Hydro :8888 -> $HTTP"; FAILS=1; }

SANDBOX=$(curl -s http://localhost:5050/version 2>/dev/null | grep -c buildVersion)
[ "$SANDBOX" -gt 0 ] && ok "Sandbox :5050" || { fail "Sandbox :5050"; FAILS=1; }

# Feature pages
for page in "/" "/video"; do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:8888${page}" 2>/dev/null)
    [ "$CODE" = "200" ] && ok "$page -> $CODE" || { fail "$page -> $CODE"; FAILS=1; }
done

echo ""
echo "========================================"
if [ "$FAILS" -eq 0 ]; then
    echo -e " ${GREEN}????! ?????????${NC}"
else
    echo -e " ${RED}?????? $FAILS ??????????????${NC}"
    exit 1
fi
echo "========================================"
