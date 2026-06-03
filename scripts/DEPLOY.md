# Hydro 测试机部署教程 (2c2g 云主机 · Debian 12)

## 前置检查

ssh 登录后先确认系统：
```bash
cat /etc/os-release | head -3
free -h          # 确认内存 2G
df -h /          # 确认磁盘 > 10G
```

---

## 第一步：系统初始化 (5 分钟)

### 1.1 更新系统 + 安装基础工具
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential python3
```

### 1.2 配置 Swap (防止内存不足 OOM)
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h | grep Swap   # 确认 Swap 已启用
```

### 1.3 安装 Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # 应显示 v20.x
```

### 1.4 安装 Yarn + PM2
```bash
sudo corepack enable
corepack prepare yarn@stable --activate
yarn --version   # 应显示 4.x

sudo npm install -g pm2
pm2 --version
```

---

## 第二步：安装 MongoDB 7 (3 分钟)

```bash
# 导入 MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

# 添加源
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# 安装
sudo apt update
sudo apt install -y mongodb-org

# 限制内存使用 (2c2g 关键优化)
sudo mkdir -p /etc/mongod.conf.d
echo -e "storage:\n  wiredTiger:\n    engineConfig:\n      cacheSizeGB: 0.3" | sudo tee /etc/mongod.conf.d/memory.conf

# 启动
sudo systemctl enable --now mongod
sudo systemctl status mongod
```

---

## 第三步：部署 Hydro (5 分钟)

### 3.1 克隆仓库
```bash
cd ~
git clone https://github.com/echocc00/js001.git Hydro
cd Hydro
git checkout base-deploy
```

### 3.2 安装依赖 + 编译
```bash
yarn install
yarn build
```

### 3.3 配置 Hydro
```bash
# 创建配置目录
mkdir -p ~/.hydro

# 数据库连接配置
cat > ~/.hydro/config.json << EOF
{
  "host": "127.0.0.1",
  "port": "27017",
  "name": "hydro",
  "username": "",
  "password": ""
}
EOF

# 插件列表 (只用默认 UI)
cat > ~/.hydro/addon.json << EOF
["@hydrooj/ui-default"]
EOF
```

### 3.4 初始化管理员 + 启动
```bash
# 创建评测机账号
node packages/hydrooj/bin/hydrooj.js cli user create systemjudge@systemjudge.local judge judge123 2
node packages/hydrooj/bin/hydrooj.js cli user setJudge 2

# 设置监听地址
node packages/hydrooj/bin/hydrooj.js cli system set server.host 0.0.0.0
node packages/hydrooj/bin/hydrooj.js cli system set server.port 8888

# 构建前端 UI (必须！否则页面 404)
yarn build:ui

# PM2 启动
pm2 start packages/hydrooj/bin/hydrooj.js --name hydro-backend
pm2 save
pm2 startup   # 开机自启 (按提示执行输出的命令)
```

### 3.5 开放防火墙
```bash
# 云主机安全组: 放行 TCP 8888 端口

# 本地防火墙 (如果启用了 ufw)
sudo ufw allow 8888/tcp 2>/dev/null || true
```

---

## 第四步：验证部署

浏览器访问: `http://<你的服务器IP>:8888`

- 注册第一个账号 (自动成为超级管理员)
- 登录后进入后台 → 系统设置
- 确认数据库连接正常

快速功能验证:
```bash
# 检查状态
curl http://localhost:8888/status

# 查看 PM2 日志
pm2 logs hydro-backend --lines 20
```

---

## 第五步：版本更新工作流 (日常操作)

### 本地推送后，测试机只需一条命令:

```bash
cd ~/Hydro && git pull origin base-deploy && yarn build && pm2 restart hydro-backend
```

也可以保存为脚本:
```bash
echo ''
cd ~/Hydro && git pull origin base-deploy && yarn build && pm2 restart hydro-backend
'' > ~/update.sh
chmod +x ~/update.sh
# 以后直接运行: bash ~/update.sh
```

### 更新前备份:
```bash
cd ~/Hydro
node packages/hydrooj/bin/hydrooj.js backup
# 生成 backup-xxxx-xx-xx-xxxxxx.zip
```

### 回滚:
```bash
cd ~/Hydro
git log --oneline -5
git checkout <目标commit>
yarn build
pm2 restart hydro-backend
```

---

## 第六步：安装评测机 (可选，需要 >2G 内存)

评测机需要 Docker (沙箱隔离):

```bash
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER
# 重新登录生效
```

然后参考 `install/docker/docker-compose.yml` 启动评测机容器。
**2c2g 建议暂不部署评测机**，先用第三方 OJ 的评测服务或等升级配置后再装。

---

## 资源占用预估

| 组件 | 内存 |
|------|------|
| MongoDB 7 (cacheSizeGB=0.3) | ~400MB |
| Hydro backend (Node.js) | ~300MB |
| PM2 | ~50MB |
| 系统 + 其他 | ~300MB |
| **合计** | **~1.1GB** |
| Swap | 2GB (安全垫) |

---

## 故障排查

```bash
# 应用不启动
pm2 logs hydro-backend --err --lines 30

# MongoDB 连不上
sudo systemctl status mongod
mongosh --eval "db.runCommand({ping:1})"

# 端口不通
ss -tlnp | grep 8888
curl http://localhost:8888/status

# 内存不足
free -h
pm2 restart hydro-backend   # 释放泄漏的内存
```
