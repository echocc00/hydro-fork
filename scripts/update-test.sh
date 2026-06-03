#!/bin/bash
# ============================================================
# ??????????????????
# ??: bash scripts/update-test.sh [--skip-build]
# ============================================================
set -e

TEST_HOST="192.168.2.19"
TEST_USER="debian"
HYDRO_DIR="/home/debian/Hydro"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "========================================"
echo " ??????: $TEST_USER@$TEST_HOST"
echo "========================================"

# ??????
SCRIPT_FILES=(
    "scripts/deploy.sh"
    "scripts/start.sh"
    "scripts/stop.sh"
    "scripts/restart.sh"
    "scripts/status.sh"
    "scripts/compile-dark-css.js"
    "scripts/deploy-ui.sh"
    "scripts/backup.sh"
    "scripts/rollback.sh"
)

echo ""
echo ">>> ??????..."
for f in "${SCRIPT_FILES[@]}"; do
    if [ -f "$LOCAL_DIR/$f" ]; then
        scp "$LOCAL_DIR/$f" "${TEST_USER}@${TEST_HOST}:${HYDRO_DIR}/$f" 2>/dev/null
        echo "  [OK] $f"
    else
        echo "  [SKIP] $f (not found locally)"
    fi
done

echo ""
echo ">>> ???????????..."
ssh "$TEST_USER@$TEST_HOST" \
    "export PATH=\$HOME/node-v22.14.0-linux-x64/bin:\$PATH && \
     cd $HYDRO_DIR && \
     chmod +x scripts/*.sh && \
     bash scripts/deploy.sh $*"

echo ""
echo "========================================"
echo " ??"
echo "========================================"
