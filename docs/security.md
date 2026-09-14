# 安全边界

> 本文记录当前已经实施的边界，不是通用安全愿望清单。任何改变 Secret、DNS、Custom Domain、证书、数据库授权或 sudoers 的操作都需要明确的管理员授权。

## 对外暴露面

| 入口 | 当前状态 |
| --- | --- |
| `https://shop.yirui.io` | 唯一面向浏览器的产品入口，由 Cloudflare Worker `shop` 提供 |
| `https://api.startyi.cn` | Nginx 源站入口；业务 API 缺少合法代理 Header 时返回 403 |
| ECS `80/443` | Nginx 监听；80 跳转 HTTPS，443 提供 `api.startyi.cn` |
| Express `3000` | 只监听 `127.0.0.1` |
| MySQL `3306` | 只监听 `127.0.0.1` |
| MySQL X Protocol `33060` | 只监听 `127.0.0.1` |
| Cloudflare `workers.dev` | 已关闭 |
| Cloudflare Preview URLs | 已关闭 |

`shop.yirui.io` 的生产 Custom Domain 由 Cloudflare Dashboard 管理。[`wrangler.jsonc`](../wrangler.jsonc) 不声明 `route`、`routes` 或 `custom_domain`，并显式设置 `workers_dev: false`、`preview_urls: false`、`observability.enabled: true`。

## Origin Proxy Secret

`ORIGIN_PROXY_SECRET` 用于证明 API 请求经过受控的 Cloudflare Worker：

1. Worker 从 Cloudflare Secret binding 读取它。
2. Worker 删除客户端对该值的控制权，始终覆盖 `X-Origin-Proxy-Token` Header。
3. Nginx 原样代理 Header 到 Express。
4. Express 生产中使用固定时序比较；不匹配时在进入业务路由前返回 403。

该 Secret 不是用户登录凭据，也不应出现在前端 bundle、Git、日志、命令输出或文档中。Worker 与 `/etc/ecommerce/backend.env` 必须保存相同的值，但只记录变量名，不记录内容。轮换需要同时协调 Cloudflare 和 ECS，当前日常部署不得顺带修改它。

## 敏感配置文件

- 生产环境文件：`/etc/ecommerce/backend.env`。
- 管理员已核验文件为 `root:root`、权限 `0600`；其父目录 `/etc/ecommerce` 当前为 `root:root`、权限 `0700`。
- `agent` 无法遍历该目录或读取、导出、打印环境文件；systemd 以 root 管理器加载后传给受限服务进程。
- 本地真实配置写在被 Git 忽略的 `backend/.env`；仓库只跟踪 [`backend/.env.example`](../backend/.env.example)。
- `.env`、`.env.*`、`.dev.vars` 和 `.wrangler/` 已被 [`.gitignore`](../.gitignore) 排除；`.env.example` 是唯一例外。
- TLS 私钥路径是 `/etc/letsencrypt/live/startyi.cn/privkey.pem`，不得读取或复制；仓库只记录 Nginx 引用路径。

当前后端环境变量名称：

| 变量 | 用途 |
| --- | --- |
| `NODE_ENV` | 生产模式开关；影响 Cookie 与源站校验 |
| `HOST` | Express 监听地址；生产必须为 `127.0.0.1` |
| `PORT` | Express 端口，当前为 3000 |
| `DB_HOST` | MySQL 地址，当前为回环地址 |
| `DB_PORT` | MySQL 端口，当前为 3306 |
| `DB_NAME` | 数据库名，当前为 `ecommerce` |
| `DB_USER` | 应用账户，当前为 `ecommerce_app` |
| `DB_PASSWORD` | 应用数据库密码 |
| `ORIGIN_PROXY_SECRET` | Worker 到源站的共享凭据 |
| `SESSION_COOKIE_NAME` | Session Cookie 名称 |
| `SESSION_TTL_DAYS` | Session 有效天数，默认 7 |

Worker 普通变量只有 `API_ORIGIN=https://api.startyi.cn`；Secret binding 只有名称 `ORIGIN_PROXY_SECRET`。

## 身份认证与 Session

- 密码使用 Argon2id 哈希；参数为 memory cost 19456、time cost 2、parallelism 1。数据库不保存明文密码。
- 未知账户登录仍执行 dummy hash 验证，减少明显的账户枚举时序差异。
- Session Token 使用 32 字节密码学随机数；数据库只存 SHA-256 哈希。
- 生产 Cookie 为 Host-only（不设置 `Domain`）、`HttpOnly`、`Secure`、`SameSite=Lax`、`Path=/`，默认有效期 7 天。
- Worker 转发浏览器 Cookie 和源站 `Set-Cookie`，但不解析或验证 Session。
- 退出会删除数据库中的当前 Session，并用相同安全属性发送过期 Cookie。
- 订单、登录购物车和 `/api/auth/me` 都依赖服务端 Session；订单查询在 SQL 中校验用户归属。

## 数据库最小权限

生产 Express 使用 `ecommerce_app@localhost`，只有 `ecommerce.*` 的 `SELECT`、`INSERT`、`UPDATE`、`DELETE`。它没有建库、改表、创建用户、授权或全局权限。MySQL root/admin 凭据只供管理员进行初始化和结构管理，不写入项目，也不供应用进程使用。

## `agent` 最小权限模型

后端文件和 release 目录由 `agent:agent` 管理；systemd 服务也以 `agent:agent` 运行。当前 `agent` 不在 `adm` 或 `systemd-journal` 组，不能读取受保护环境文件，也没有通用 root shell 或通用 `systemctl` 权限。

`sudo -n -l` 实际白名单只有：

```text
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
/usr/local/sbin/ecommerce-safe-restart
```

`/usr/local/sbin/ecommerce-safe-restart` 为 `root:root`、`0755`，内部只重启 `ecommerce.service` 并验证它恢复 active。日常后端重启必须使用该包装命令：

```sh
sudo -n /usr/local/sbin/ecommerce-safe-restart
```

不要把失败的 `sudo systemctl restart ecommerce.service` 当作权限故障绕过；直接重启并未列入白名单。

## systemd 沙箱

当前 unit 启用：

- `NoNewPrivileges=true`
- `PrivateTmp=true`
- `ProtectSystem=strict`
- `ProtectHome=true`
- `ProtectKernelTunables=true`
- `ProtectKernelModules=true`
- `ProtectControlGroups=true`
- 空 `CapabilityBoundingSet` 与 `AmbientCapabilities`
- 地址族限制为 `AF_UNIX AF_INET AF_INET6`
- `UMask=0027`

服务只依赖网络和 MySQL，不直接提供静态资源。

## 输入与错误边界

- Express JSON body 上限为 32 KiB；Nginx `client_max_body_size` 同样为 `32k`。
- 商品 ID、数量、订单 ID、用户名、邮箱和密码都在进入数据库操作前校验。
- SQL 值使用参数绑定；动态订单项占位符数量来自已经查询到的订单行，不接受客户端 SQL 片段。
- 未预期异常只向客户端返回 `INTERNAL_ERROR`，日志仅记录异常类型，不返回堆栈或数据库细节。
- 浏览器只发同源请求，后端没有启用 CORS。

## 当前未实现的安全能力

当前没有显式 CSRF Token、登录限流/账户锁定、MFA、邮箱验证、密码找回、管理后台或真实支付。`SameSite=Lax` 和 Host-only Cookie 是现有 CSRF/作用域保护，但不能在文档中声称已经实现独立 CSRF Token。任何新增能力应先重新评估信任边界。

[返回项目入口](../README.md) · [架构](architecture.md) · [部署](deployment.md) · [运维](operations.md)
