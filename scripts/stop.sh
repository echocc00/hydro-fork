#!/bin/bash
# ============================================================
# Hydro ?????? - ????????????
# ??: bash scripts/stop.sh
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'

echo "========================================"
echo " Hydro ??????"
echo "========================================"

# ????: judge -> backend -> sandbox
# hydrojudge ?? backend WebSocket
# backend ?? MongoDB (???????)
# sandbox ???????

echo ""
echo ">>> [1/3] ?? hydrojudge..."
if pm2 show hydrojudge 2>/dev/null | grep -q 'online'; then
    pm2 stop hydrojudge
    echo -e "${GREEN}[OK]${NC} hydrojudge stopped"
else
    echo -e "${GREEN}[OK]${NC} hydrojudge not running"
fi

echo ""
echo ">>> [2/3] ?? hydro-backend..."
if pm2 show hydro-backend 2>/dev/null | grep -q 'online'; then
    pm2 stop hydro-backend
    echo -e "${GREEN}[OK]${NC} hydro-backend stopped"
else
    echo -e "${GREEN}[OK]${NC} hydro-backend not running"
fi

echo ""
echo ">>> [3/3] ?? sandbox..."
if pm2 show sandbox 2>/dev/null | grep -q 'online'; then
    pm2 stop sandbox
    echo -e "${GREEN}[OK]${NC} sandbox stopped"
else
    echo -e "${GREEN}[OK]${NC} sandbox not running"
fi

echo ""
echo -e "${GREEN}????????${NC}"
echo "MongoDB (????) ?????"
