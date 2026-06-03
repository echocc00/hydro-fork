#!/bin/bash
# ============================================================
# Hydro ??????
# ??: bash scripts/restart.sh
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ">>> ??????..."
bash "$SCRIPT_DIR/stop.sh"

echo ""
echo ">>> ?? 2 ???????..."
sleep 2

echo ""
echo ">>> ??????..."
bash "$SCRIPT_DIR/start.sh"
