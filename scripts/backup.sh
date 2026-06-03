#!/bin/bash
# Hydro 备份脚本
# 用法: bash scripts/backup.sh

set -e

HYDRO_DIR="$HOME/Hydro"
cd "$HYDRO_DIR"

echo ">>> 执行 Hydro 备份..."
node packages/hydrooj/bin/hydrooj.js backup

echo ">>> 备份文件列表:"
ls -lh backup-*.zip 2>/dev/null || echo "(备份文件存放在 Hydro 根目录)"
