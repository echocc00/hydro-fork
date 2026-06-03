
---

## 环境与工具路径（每会话必读）

- Git: D:\AI\git\Git\bin\git.exe
- Git sandbox 绕过: 每次 git 命令需加 `-c safe.directory=F:/codex/js001/Hydro`
- Yarn Berry 运行方式: `node .yarn/releases/yarn-4.14.1.cjs <command>`
- Yarn 命令需设置环境变量:
  ```powershell
  $env:YARN_GLOBAL_FOLDER=''F:\codex\js001\Hydro\.yarn\berry-global''
  $env:YARN_CACHE_FOLDER=''F:\codex\js001\Hydro\.yarn\berry-cache''
  ```
- 代理: V2Ray mixed 127.0.0.1:10808，Node.js 网络可用，Git/PowerShell HTTPS 不可用
- 推送到 GitHub: 通过 Node.js fetch + REST API（scripts/push-final.js 模式）
- GitHub Token: 用户每次提供 fine-grained token（Contents: Read and write）
- 远程仓库: https://github.com/echocc00/js001.git (origin), https://github.com/hydro-dev/Hydro.git (upstream)
- 本地工作目录: F:\codex\js001\Hydro

---

## 进度追踪

### 已完成 (2026-05-20)

- [x] Hydro 源码下载到 F:\codex\js001\Hydro
- [x] Node.js v24.15.0, Yarn Berry 4.14.1 配置完成
- [x] yarn install — 2027 个包安装成功
- [x] yarn build — 28 个子项目 TypeScript 编译通过，零错误
- [x] AGENTS.md 创建（含项目指引）
- [x] standard-version + cz-conventional-changelog 安装（devDependencies）
- [x] 版本管理脚本配置:
  - `yarn commit` → git-cz 交互式规范提交
  - `yarn release:patch` → 修订号发布
  - `yarn release:minor` → 新功能发布
  - `yarn release:major` → 大版本发布
- [x] `.versionrc` 配置（版本号 + CHANGELOG 自动生成）
- [x] `CHANGELOG.md` 创建（v0.1.0 初始记录）
- [x] `.gitignore` 增强（新增 *.env, backup-*.zip 忽略）
- [x] `scripts/deploy.sh` — 测试机一键部署
- [x] `scripts/backup.sh` — 数据库备份
- [x] `scripts/rollback.sh` — 代码/数据回滚
- [x] Git 仓库初始化并推送到 GitHub:
  - 远程: `echocc00/js001`
  - `master` 分支: 885bb2f
  - `base-deploy` 分支: 885bb2f (新建)
  - 上游跟踪: `hydro-dev/Hydro`
- [x] 本地 Git 重新初始化（等待用户 fetch）

### 当前状态

- **所有代码已推送到 GitHub** (master: b1af179, base-deploy: b1af179)
- CodeGraph 已安装并索引 (450 文件, 6416 节点, 5936 边)
- 本地 git 因沙箱权限限制不可靠，所有 git 操作走 GitHub REST API
- 用户本地终端 git 可用于手动操作 (fetch/checkout 等)
### 下一步 (Day 2+)

1. 用户同步本地 git 后 → 确认本地仓库状态
2. 测试机（Linux + Docker）:
   - 安装 Node.js 20+ / Yarn / PM2
   - 启动 MongoDB Docker: `docker run -d --name oj-mongo -v /data/hydro/mongo:/data/db -p 127.0.0.1:27017:27017 mongo:7-jammy`
   - Clone 仓库: `git clone https://github.com/echocc00/js001.git ~/Hydro`
   - 安装依赖 + 编译: `yarn install && yarn build`
   - 配置 ~/.hydro/config.json
   - 启动: `pm2 start packages/hydrooj/bin/hydrooj.js --name hydro-backend`
3. 验证部署: 访问 http://<测试机IP>:8888
4. 本地修改 → push → 测试机 pull + build + restart（增量更新验证）
5. 第一个插件开发（登录扩展 / 自定义排行榜 / 题目标签）

---

## 分支策略

```
上游 hydro-dev/Hydro (upstream/master)
  └── 你的 master (origin/master) — 跟踪上游，只同步
       └── base-deploy — 测试机跟踪，合入已验证功能
            ├── feat/xxx — 功能分支
            └── fix/xxx — 修复分支
```

## 测试机更新命令

```bash
cd ~/Hydro && git pull origin base-deploy && yarn build && pm2 restart hydro-backend
```

## 备份与回滚

```bash
# 备份
node packages/hydrooj/bin/hydrooj.js backup

# 代码回滚
git checkout <commit> && yarn build && pm2 restart hydro-backend

# 数据回滚
node packages/hydrooj/bin/hydrooj.js restore backup-xxx.zip
```
