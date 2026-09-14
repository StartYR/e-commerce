# 生产部署

> 状态快照：2026-09-14。生产部署已经完成；本文记录现有拓扑和已经采用的发布流程，不是待实施方案。

## 生产清单

| 项目 | 当前值 |
| --- | --- |
| 正式网站 | `https://shop.yirui.io` |
| Cloudflare Worker | `shop` |
| Worker 内容 | `dist/` Static Assets + `/api/*` 固定代理 |
| Custom Domain | `shop.yirui.io`，由 Dashboard 管理 |
| `workers.dev` / Preview URLs | 均关闭 |
| Observability | 已启用 |
| 后端源站 | `https://api.startyi.cn` |
| Nginx | 80/443；`/api/` → `http://127.0.0.1:3000` |
| Express | `127.0.0.1:3000` |
| MySQL / X Protocol | `127.0.0.1:3306` / `127.0.0.1:33060` |
| systemd 服务 | `ecommerce.service`，enabled、active |
| 服务账户 | `agent:agent` |
| 部署根目录 | `/srv/ecommerce` |
| 当前后端 release | `/srv/ecommerce/releases/20260914T074610Z-cd978d293850` |
| 当前 release 链接 | `/srv/ecommerce/current` |
| Node.js runtime | `/srv/ecommerce/runtime/node-v24.21.0-linux-x64` |
| runtime 链接 | `/srv/ecommerce/runtime/current` |
| 生产环境文件 | `/etc/ecommerce/backend.env` |
| systemd unit | `/etc/systemd/system/ecommerce.service` |
| Nginx site | `/etc/nginx/sites-available/api.startyi.cn` |
| Nginx enabled link | `/etc/nginx/sites-enabled/api.startyi.cn` |
| MySQL 回环配置 | `/etc/mysql/mysql.conf.d/zz-ecommerce-bind.cnf` |

当前仓库 `main` 的核验基线为 `f5843a7`。后端 release 名称带有打包时的提交前缀 `cd978d293850`；`backend/` 与 `database/` 在该提交到当前基线之间没有代码差异。生产 systemd 与 Nginx 文件内容的 SHA-256 已与仓库 [`deploy/`](../deploy/) 对应文件核对一致。

## 组件部署边界

```mermaid
flowchart TB
    R[Git 工作区]
    F[npm run build<br/>dist/]
    C[Wrangler deploy<br/>Worker shop]
    B[backend + database + deploy<br/>release tar]
    S[/srv/ecommerce/releases/id]
    L[/srv/ecommerce/current]
    D[ecommerce.service]

    R --> F --> C
    R --> B --> S
    S -->|install script 原子切换| L
    L -->|safe restart 后生效| D
```

- 前端和 Worker 一起通过 Wrangler 发布。
- 后端通过 ECS release 目录、`current` 符号链接和 systemd 发布。
- 数据库 schema/seed 不属于日常应用发布自动步骤。
- Nginx、systemd、MySQL bind、证书和 sudoers 属于管理员维护的系统配置。
- 当前仓库没有已跟踪的 GitHub Actions 或其他 CI/CD 工作流；生产发布是人工执行和验证的。

## 发布前检查

在仓库根目录执行：

```sh
git status --short --branch
npm test
npm run build
git diff --check
```

涉及真实数据库逻辑时，在本地开发数据库上另行执行：

```sh
npm --prefix backend run test:db
npm run test:live
```

`test:db` 和 `test:live` 会写入测试数据，禁止将 `backend/.env` 指向生产库后执行。发布包不得包含 `backend/.env`、`.wrangler/`、`.dev.vars`、`node_modules` 或其他认证材料。

## 前端与 Worker 发布

[`wrangler.jsonc`](../wrangler.jsonc) 必须保持：

- `name: "shop"`；
- `assets.directory: "./dist"`；
- `/api/*` 在 Static Assets 前进入 Worker；
- `workers_dev: false`；
- `preview_urls: false`；
- `observability.enabled: true`；
- 不增加 `route`、`routes` 或 `custom_domain`；
- 不在文件中写入 `ORIGIN_PROXY_SECRET` 的值。

发布步骤：

```sh
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy
```

Wrangler 登录是操作者本机状态，不属于仓库。若 CLI 未授权，使用当前 Wrangler 支持的 device flow：

```sh
npx wrangler login --device
```

出现验证 URL 和 user code 后必须由用户在浏览器中完成授权，并等待 CLI 明确显示 `Successfully logged in`。不要使用临时账户、不要新建第二个 Worker，也不要在授权过程中修改 Secret 或路由。

真实部署后必须分别验证：

```sh
curl --fail --silent --show-error https://shop.yirui.io/ --output /dev/null
curl --fail --silent --show-error https://shop.yirui.io/api/products --output /dev/null
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' https://api.startyi.cn/api/products
```

前两个请求应成功；无 `X-Origin-Proxy-Token` 直连源站应为 403。还要在 Dashboard 确认生产 Custom Domain 仍存在、`workers.dev` 与 Preview URLs 仍关闭、Observability 仍启用。单个 200 不能替代这些检查。

## 后端 release 发布

生产机通过本地 SSH alias `aliyun-agent` 登录受限账户 `agent`。release 由 `backend/`、`database/` 和 `deploy/` 组成；当前安装脚本会安装生产依赖、执行后端测试、检查所有后端 JavaScript 语法，并原子切换 `/srv/ecommerce/current`。

以下 PowerShell 流程与首次生产发布采用的目录和边界一致。占位变量只用于本次发布：

```powershell
$releaseId = "$(Get-Date -AsUTC -Format 'yyyyMMddTHHmmssZ')-$(git rev-parse --short=12 HEAD)"
$releaseBundle = Join-Path ([IO.Path]::GetTempPath()) "ecommerce-release-$releaseId.tar"

tar -cf $releaseBundle `
  --exclude='backend/node_modules' `
  --exclude='backend/.env' `
  backend database deploy

tar -tf $releaseBundle
ssh aliyun-agent "mkdir -m 0755 -- /srv/ecommerce/releases/$releaseId"
scp $releaseBundle "aliyun-agent:/srv/ecommerce/releases/$releaseId/release.tar"
```

上传后，在远端先检查 archive，再解包。命令中的 `$releaseId` 由本地 PowerShell展开；不要把 release 目标改到 `/srv/ecommerce` 根目录或已有 release：

```powershell
ssh aliyun-agent "cd /srv/ecommerce/releases/$releaseId && tar -tf release.tar"
ssh aliyun-agent "cd /srv/ecommerce/releases/$releaseId && tar -xf release.tar && rm -f -- release.tar"
ssh aliyun-agent "bash /srv/ecommerce/releases/$releaseId/deploy/install-backend-release.sh /srv/ecommerce/releases/$releaseId"
```

确认安装脚本成功输出 `Activated backend release` 后，使新 release 进入运行态：

```powershell
ssh aliyun-agent "sudo -n /usr/local/sbin/ecommerce-safe-restart"
```

最后执行 [运维文档](operations.md) 中的服务状态和公网健康检查。临时本地 tar 包可以在确认远端发布完成后删除；删除前应核对它位于系统临时目录且文件名与本次 `$releaseId` 完全一致。

### 安装脚本的原子边界

[`deploy/install-backend-release.sh`](../deploy/install-backend-release.sh) 只接受 `/srv/ecommerce/releases/*` 下已经存在的目录。它通过临时符号链接和 `mv -Tf` 原子替换 `current`；但是正在运行的 Node 进程仍使用旧代码，直到执行安全重启。安装成功而重启失败时，应把 `current` 切回已知良好的旧 release，再重启，流程见 [回滚](operations.md#回滚后端-release)。

## 数据库发布边界

日常后端发布不会自动执行 [`database/schema.sql`](../database/schema.sql) 或 [`database/seed.sql`](../database/seed.sql)。原因是生产应用账户只有 DML 权限，且仓库当前没有版本化 migration 系统。

- 本地初始化：使用 `npm --prefix backend run db:setup` 和管理员 login-path `ecommerce-setup`。
- 生产建库、账户授权、DDL 或数据恢复：由管理员审核并使用管理员凭据手动执行。
- `seed.sql` 重复执行不会重置库存，但仍不应被当成无审查的日常生产发布步骤。

## 系统配置变更

`agent` 不能写 `/etc`。以下内容由管理员安装或更新：

- `/etc/ecommerce/backend.env`
- `/etc/systemd/system/ecommerce.service`
- `/etc/nginx/sites-available/api.startyi.cn` 及 enabled link
- `/etc/mysql/mysql.conf.d/zz-ecommerce-bind.cnf`
- `/usr/local/sbin/ecommerce-safe-restart`
- 对应 sudoers 白名单、TLS 证书、DNS 和 Cloudflare Dashboard 配置

管理员完成 Nginx 文件变更后，`agent` 可以且只能执行：

```sh
sudo -n /usr/sbin/nginx -t
sudo -n /usr/bin/systemctl reload nginx
```

必须先通过 `nginx -t`，再 reload。systemd unit 发生变化时需要管理员执行 `daemon-reload`；该操作不在 `agent` 白名单中。

## 职责划分

| 角色 | 当前职责 |
| --- | --- |
| 人类 / Cloudflare 管理员 | 浏览器授权、Worker Secret、DNS、Custom Domain、Dashboard 设置 |
| ECS 管理员（`ecs-user`） | `/etc` 配置、证书、MySQL 管理员操作、systemd 安装/daemon-reload、sudoers |
| 受限账户 `agent` | 上传 release、运行安装脚本、切换 `current`、安全重启服务、Nginx 语法检查与 reload |
| 应用进程 | 使用 `ecommerce_app` 进行业务 DML；不执行 DDL 或账户管理 |

[返回项目入口](../README.md) · [架构](architecture.md) · [运维](operations.md) · [安全](security.md)
