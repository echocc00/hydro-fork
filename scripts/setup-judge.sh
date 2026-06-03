#!/bin/bash
# Hydro Judge 评测环境安装脚本 (测试机 192.168.2.19)
# 用法: bash setup-judge.sh
# 前置: hydro-backend 已运行, MongoDB 已运行

set -e

echo "========================================"
echo " Hydro Judge 评测环境安装"
echo "========================================"

export PATH=$HOME/node-v22.14.0-linux-x64/bin:$HOME/bin:$PATH
HYDRO_CONFIG_DIR="$HOME/.hydro"
SANDBOX_BIN="$HOME/bin/sandbox"
SANDBOX_VERSION="1.9.4"
SANDBOX_URL="https://github.com/criyle/go-judge/releases/download/v${SANDBOX_VERSION}/go-judge_${SANDBOX_VERSION}_linux_amd64v3"

echo ""
echo "[1/6] 检测系统环境..."
echo "  Kernel: $(uname -r)"
echo "  Arch:   $(uname -m)"

# ── 2. 安装 go-judge sandbox ─────────────
echo ""
echo "[2/6] 安装 go-judge sandbox v${SANDBOX_VERSION}..."

mkdir -p "$HOME/bin"

if [ -f "$SANDBOX_BIN" ]; then
    echo "  sandbox 已存在，跳过下载"
else
    if wget -q --timeout=10 "$SANDBOX_URL" -O "$SANDBOX_BIN"; then
        chmod +x "$SANDBOX_BIN"
        echo "  ✓ sandbox 安装完成"
    else
        echo "  ⚠ GitHub 下载失败 (网络不通)，请手动上传 sandbox 到 $SANDBOX_BIN"
        echo "  下载地址: $SANDBOX_URL"
    fi
fi

# ── 3. 创建 mount.yaml ──────────────────
echo ""
echo "[3/6] 创建 sandbox mount 配置..."

mkdir -p "$HYDRO_CONFIG_DIR"

cat > "$HYDRO_CONFIG_DIR/mount.yaml" << 'MOUNTEOF'
mount:
  - type: bind
    source: /bin
    target: /bin
    readonly: true
  - type: bind
    source: /lib
    target: /lib
    readonly: true
  - type: bind
    source: /lib64
    target: /lib64
    readonly: true
  - type: bind
    source: /usr
    target: /usr
    readonly: true
  - type: bind
    source: /etc
    target: /etc
    readonly: true
  - type: bind
    source: /var
    target: /var
    readonly: true
  - type: bind
    source: /dev/null
    target: /dev/null
  - type: bind
    source: /dev/urandom
    target: /dev/urandom
  - type: bind
    source: /dev/zero
    target: /dev/zero
  - type: tmpfs
    target: /w
    data: size=512m,nr_inodes=8k
  - type: tmpfs
    target: /tmp
    data: size=512m,nr_inodes=8k
proc: true
workDir: /w
hostName: executor_server
domainName: executor_server
uid: 1536
gid: 1536
MOUNTEOF

echo "  ✓ mount.yaml 已创建"

# ── 4. testlib.h (git submodule) ────────
echo ""
echo "[4/6] 检查 testlib.h..."

TESTLIB_PATH="$HOME/Hydro/packages/hydrojudge/vendor/testlib/testlib.h"
if [ -f "$TESTLIB_PATH" ]; then
    echo "  testlib.h 已存在 ($(wc -c < $TESTLIB_PATH) bytes)"
else
    echo "  testlib.h 不存在 (git submodule), 尝试下载..."
    if wget -q --timeout=10 "https://raw.githubusercontent.com/MikeMirzayanov/testlib/master/testlib.h" -O "$TESTLIB_PATH"; then
        echo "  ✓ testlib.h 下载完成"
    else
        echo "  ⚠ 下载失败，请手动放置 testlib.h 到:"
        echo "    $TESTLIB_PATH"
        echo "  来源: https://raw.githubusercontent.com/MikeMirzayanov/testlib/master/testlib.h"
    fi
fi

# ── 5. 创建 judge.yaml (带 cookie 注入) ──
echo ""
echo "[5/6] 配置 hydrojudge 连接..."

SERVER_URL="http://localhost:8888/"

echo "  尝试获取 session cookie..."
COOKIE=""
if wget -qO /dev/null \
    --post-data="uname=Hydro&password=judgepass123&rememberme=on" \
    --header="Content-Type: application/x-www-form-urlencoded" \
    --save-cookies /tmp/judge_cookies.txt \
    "$SERVER_URL"login 2>/dev/null; then
    SID=$(grep 'sid' /tmp/judge_cookies.txt | grep -v 'sid.sig' | awk '{print $NF}')
    if [ -n "$SID" ]; then
        COOKIE="sid=$SID"
        echo "  ✓ cookie 获取成功"
    fi
    rm -f /tmp/judge_cookies.txt
else
    echo "  ⚠ 无法获取 cookie (judge 需要手动配置)"
fi

cat > "$HYDRO_CONFIG_DIR/judge.yaml" << JUDGEEOF
hosts:
  localhost:
    type: hydro
    server_url: $SERVER_URL
    uname: Hydro
    password: judgepass123
    detail: full
    cookie: $COOKIE
JUDGEEOF

echo "  ✓ judge.yaml 已创建"
echo ""
echo "  ⚠ 如需修改账号，编辑 ~/.hydro/judge.yaml"
echo "     默认: Hydro / judgepass123"
echo "     可用 hydrooj CLI 修改:"
echo "     cd ~/Hydro && DEFAULT_STORE_PATH=\$HOME/hydro-data/file node packages/hydrooj/bin/hydrooj.js cli user setPassword UID NEWPASS"

# ── 6. 启动服务 ──────────────────────────
echo ""
echo "[6/6] 启动评测服务..."

# 停止旧进程
pm2 delete sandbox 2>/dev/null || true
pm2 delete hydrojudge 2>/dev/null || true

# sandbox (注意: flag 是 -http-addr 和 -mount-conf)
pm2 start "$SANDBOX_BIN" --name sandbox -- \
    -mount-conf "$HYDRO_CONFIG_DIR/mount.yaml" \
    -http-addr 0.0.0.0:5050 \
    -release

sleep 2

# hydrojudge
HYDROJUDGE_BIN="$HOME/Hydro/packages/hydrojudge/node_modules/.bin/hydrojudge"
if [ ! -f "$HYDROJUDGE_BIN" ]; then
    echo "  编译 hydrojudge..."
    cd "$HOME/Hydro" && yarn build 2>&1 | tail -3
fi

pm2 start "$HYDROJUDGE_BIN" --name hydrojudge

sleep 3
pm2 save

echo ""
echo "========================================"
echo " 验证评测链路"
echo "========================================"
echo ""

FAILS=0
ps aux | grep mongod | grep -v grep >/dev/null && echo "  [✓] MongoDB" || { echo "  [✗] MongoDB"; FAILS=$((FAILS+1)); }
[ -f ~/.hydro/config.json ] && echo "  [✓] Config" || { echo "  [✗] Config"; FAILS=$((FAILS+1)); }
wget -qO- http://localhost:8888/status 2>/dev/null | grep -q Hydro && echo "  [✓] hydro-backend :8888" || { echo "  [✗] hydro-backend :8888"; FAILS=$((FAILS+1)); }
wget -qO- http://localhost:5050/version 2>/dev/null | grep -q buildVersion && echo "  [✓] sandbox :5050" || { echo "  [✗] sandbox :5050"; FAILS=$((FAILS+1)); }
pm2 list 2>/dev/null | grep hydrojudge | grep -q online && echo "  [✓] hydrojudge" || { echo "  [✗] hydrojudge"; FAILS=$((FAILS+1)); }

echo ""
if [ $FAILS -eq 0 ]; then
    echo "✅ 全部通过！评测环境已就绪。"
else
    echo "⚠ $FAILS 项未通过，请检查上方 [✗] 项。"
fi
