#!/bin/bash
# Hydro 回滚脚本
# 用法: bash scripts/rollback.sh             # 回滚代码到上一个版本
#       bash scripts/rollback.sh <commit>    # 回滚到指定commit
#       bash scripts/rollback.sh --data <backup.zip>  # 回滚数据

set -e

HYDRO_DIR="$HOME/Hydro"
cd "$HYDRO_DIR"

if [ "$1" = "--data" ]; then
    echo ">>> 恢复数据从: $2"
    node packages/hydrooj/bin/hydrooj.js restore "$2"
    echo ">>> 数据回滚完成"
    exit 0
fi

TARGET="${1:-HEAD~1}"

echo ">>> 回滚代码到: $TARGET"
git checkout "$TARGET"

echo ">>> 重新编译..."
yarn build

echo ">>> 重启应用..."
pm2 restart hydro-backend

echo ">>> 回滚完成。当前版本:"
git log --oneline -1
