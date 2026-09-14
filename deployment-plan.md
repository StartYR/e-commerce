# e-commerce 最终架构与部署规范

> 项目目录：`D:\Code\Projects\e-commerce`  
> 项目性质：数据库系统原理课程作业  
> 对外地址：`https://shop.yirui.io`  
> 后端源站：`https://api.startyi.cn`  
> 本文档用于约束后续 Codex 的开发与部署行为。除非用户明确修改本方案，否则以本文档为准。
> 外部平台前置条件已于 2026-09-14 按实际环境复核；后文所列状态以本版本为准。

---

## 1. 目标

将当前的 Vue 3 + Vite 静态文具商店，渐进式改造成一个真正的动态电子商务网站，并重点体现《数据库系统原理》课程知识。

最终系统应具备：

- 商品数据来自 MySQL，而不是前端静态 JavaScript。
- 用户可以注册、登录、退出。
- 登录状态使用服务端 Session。
- 游客购物车可以继续使用 `localStorage`。
- 登录用户购物车持久化到 MySQL。
- 用户可以创建订单并查看自己的历史订单。
- 下单过程使用数据库事务完成订单写入和库存扣减。
- 前端、后端、数据库分层清晰。
- 对外只展示 `https://shop.yirui.io`。
- 浏览器仅请求同源 `/api/*`，不直接访问 `api.startyi.cn`。
- MySQL 和 Express 均不直接暴露到公网。

本项目不追求完整商业电商能力。第一阶段不实现真实支付、物流、短信、OAuth、推荐系统、Redis、消息队列、微服务等与课程重点无关的功能。

---

## 2. 最终技术栈

| 层 | 技术 |
|---|---|
| 正式网站 | `https://shop.yirui.io` |
| 前端 | Vue 3 + JavaScript |
| 路由 | Vue Router |
| 构建 | Vite 7 |
| 边缘部署 | Cloudflare Workers + Static Assets |
| API 边缘层 | 同一个 Cloudflare Worker，仅做反向代理 |
| 后端源站 | `https://api.startyi.cn` |
| Web Server | Nginx |
| Backend | Node.js + Express + JavaScript |
| Database | MySQL 8.4 |
| 数据库驱动 | `mysql2` |
| ORM | 不使用 |
| 登录 | Session + Secure HttpOnly Cookie |
| 密码 | Argon2 或 bcrypt 哈希 |
| 后端守护 | systemd |
| 服务器 | 现有阿里云中国大陆 ECS |

明确不采用：

- React 重写
- TypeScript 重写
- GitHub Pages
- Cloudflare Pages
- Cloudflare D1
- 美国 VPS
- JWT
- Prisma / Sequelize / TypeORM / Drizzle 等 ORM
- Docker（当前阶段无必要）

---

## 3. 最终请求链路

```text
用户
 │
 ▼
https://shop.yirui.io
 │
 ▼
Cloudflare Worker
 ├─ 普通页面 / JS / CSS / 图片
 │      └─ Cloudflare Static Assets
 │
 └─ /api/*
        │
        │ HTTPS
        │ + X-Origin-Proxy-Token
        ▼
https://api.startyi.cn
        │
        ▼
Nginx :443
        │
        ▼
127.0.0.1:3000
        │
        ▼
Express
        │
        ▼
127.0.0.1:3306
        │
        ▼
MySQL
```

浏览器永远只看到：

```text
https://shop.yirui.io
https://shop.yirui.io/api/...
```

前端禁止直接写：

```text
https://api.startyi.cn/...
```

---

## 4. 已由用户手动完成的外部前置条件

以下事项属于平台控制面、域名或账号级操作，不交给 Codex 自动完成。

Codex 应直接假定这些事项已经由用户处理完毕，不要尝试登录网页控制台、修改账号设置或自行创建相关资源。

### Cloudflare

- `yirui.io` 已在 Cloudflare 管理。
- Cloudflare Worker 已由用户手动创建。
- Worker 已绑定自定义域名 `shop.yirui.io`。
- `shop.yirui.io` 所需 DNS / Custom Domain 状态已正常。
- Worker Secret `ORIGIN_PROXY_SECRET` 已由用户手动配置。
- **Wrangler CLI 的首次账号授权尚未预先完成。** Codex 可以在项目中安装 Wrangler 并发起登录/部署；如出现浏览器授权步骤，必须暂停并由用户亲自完成授权。
- 在写入 `wrangler.jsonc` 的 `name` 之前，必须确认当前已创建 Worker 的**准确名称**。不得猜测名称，也不得因为名称不一致而新建第二个 Worker。

### `api.startyi.cn`

- `startyi.cn` 已完成 ICP 备案。
- `api.startyi.cn` 的 A 记录已由用户手动配置，并已验证能够解析到现有阿里云 ECS。
- 现有 Let's Encrypt 证书 `startyi.cn` 已扩展覆盖：
  - `startyi.cn`
  - `calcx.startyi.cn`
  - `api.startyi.cn`
- 现有证书文件固定为：
  - `/etc/letsencrypt/live/startyi.cn/fullchain.pem`
  - `/etc/letsencrypt/live/startyi.cn/privkey.pem`
- Certbot 自动续期任务已经存在。
- **`api.startyi.cn` 的专用 Nginx server block 尚未配置。** 当前证书材料已经准备好，真正的 `api.startyi.cn -> Express` HTTPS 入口由后续 Codex 配置。
- Codex **不得重新申请、替换或扩展证书**，也不得运行 Certbot 修改现有证书体系；只使用上述现有证书路径。
- Codex 不负责修改域名注册信息或操作备案。

### 阿里云

- ECS 已存在并可通过 SSH 登录。
- 安全组已由用户手动确认：
  - 公网允许 `80/TCP`、`443/TCP`。
  - SSH `22/TCP` 当前允许公网访问。
  - ICMP 当前允许。
  - `3000/TCP` 不向公网开放。
  - `3306/TCP` 不向公网开放。
- ECS 上已创建：
  - `/etc/ecommerce/`
  - `/etc/ecommerce/backend.env`
- `/etc/ecommerce/backend.env` 当前为 `root:root`、权限 `0600`，并已保存与 Cloudflare Worker 完全一致的 `ORIGIN_PROXY_SECRET`。
- Codex **不得删除、覆盖或重新生成现有 `ORIGIN_PROXY_SECRET`**，也不得把该值打印到终端、日志或聊天输出中。
- 后续需要增加数据库等环境变量时，应在保留现有 Secret 的前提下安全更新 `/etc/ecommerce/backend.env`。
- Codex 不修改阿里云控制台、安全组、备案或账号级配置。

如上述任一前置条件在执行时与实际环境不一致，Codex 应停止对应部署步骤并明确指出差异，不得擅自换方案。

---

## 5. 当前项目基线

当前仓库：

```text
D:\Code\Projects\e-commerce
```

现状：

- Vue 3
- Vue Router
- Vite 7
- JavaScript
- 单页 SPA
- 商品来自 `src/data/products.js`
- 购物车来自浏览器 `localStorage`
- 无后端
- 无数据库
- 无认证
- 无 API
- 无 Cloudflare Workers 配置

现有前端应保留并渐进式改造，不得推倒重写。

现有测试：

- Node test runner
- Playwright

应尽量继续保留。

---

## 6. 目标目录结构

不进行无意义的大规模目录搬迁。

保留现有前端位于仓库根目录，新增后端、数据库和 Cloudflare 层：

```text
e-commerce/
│
├─ src/
│  ├─ components/
│  ├─ composables/
│  ├─ data/
│  ├─ lib/
│  ├─ views/
│  ├─ App.vue
│  └─ main.js
│
├─ public/
│
├─ cloudflare/
│  └─ worker.js
│
├─ backend/
│  ├─ src/
│  │  ├─ app.js
│  │  ├─ config/
│  │  ├─ db/
│  │  ├─ middleware/
│  │  ├─ routes/
│  │  └─ services/
│  ├─ package.json
│  └─ package-lock.json
│
├─ database/
│  ├─ schema.sql
│  ├─ seed.sql
│  └─ migrations/
│
├─ tests/
│
├─ wrangler.jsonc
├─ vite.config.js
├─ package.json
├─ package-lock.json
└─ README.md
```

原则：

- 根 `package.json`：前端 + Cloudflare 部署相关依赖。
- `backend/package.json`：Express 后端独立依赖。
- 不引入 monorepo 工具。
- 不为了目录美观迁移现有 `src/`。

---

## 7. 前端改造规范

### 7.1 路由

将 Vue Router 从：

```js
createWebHashHistory()
```

改为：

```js
createWebHistory()
```

最终 URL 应为：

```text
/
 /cart
 /login
 /register
 /orders
 /orders/:id
```

而不是：

```text
/#/
/#/cart
```

Cloudflare Static Assets 必须配置 SPA fallback，使直接访问 `/cart`、`/orders` 等路径时仍返回 `index.html`。

### 7.2 API 调用

所有前端 API 调用统一使用相对路径：

```js
fetch('/api/products')
fetch('/api/auth/login')
fetch('/api/orders')
```

禁止：

```js
fetch('https://api.startyi.cn/...')
```

禁止在浏览器代码中出现：

- 数据库密码
- `ORIGIN_PROXY_SECRET`
- ECS 地址
- MySQL 连接信息

### 7.3 商品数据

当前：

```text
src/data/products.js
```

中的 12 个商品作为数据库初始数据来源。

完成数据库接入后，正式运行时的商品数据必须来自：

```text
GET /api/products
```

`products.js` 不再作为生产业务数据源，可以保留为历史参考或迁移到 `database/seed.sql` 后删除。

迁移时必须先检查当前 12 个商品的完整字段。现有商品除了业务字段外还包含插画、颜色等展示元数据，不能在数据库迁移时静默丢失。处理原则：

- `name`、`category`、`description`、`price`、库存等业务数据来自 MySQL。
- 纯 UI 展示元数据可以继续保留在前端的独立 presentation mapping 中，按稳定商品 ID 关联；不要为了展示字段破坏关系模型。
- 如果某个展示字段实际属于商品业务数据，再明确建模到数据库。
- 优先保持现有商品 `id` 稳定，以避免破坏当前 `localStorage` 中 `{ productId, quantity }` 的购物车数据。
- 如果数据库模型必须改变商品 ID 格式，应显式升级购物车存储版本并处理旧 `shiye-cart-v1` 数据，不得让旧购物车静默映射到错误商品。

### 7.4 购物车

保留现有游客购物车逻辑：

```text
未登录用户
→ localStorage
```

登录用户使用：

```text
登录用户
→ /api/cart
→ MySQL
```

后续可以实现：

```text
游客 localStorage 购物车
        ↓
      登录
        ↓
合并到数据库购物车
```

但这不是第一阶段上线的硬性阻塞项。

---

## 8. Cloudflare Worker 规范

Worker 的职责必须保持极薄。

### 8.1 Worker 允许做的事情

- 托管 Vite 构建后的 `dist/` 静态资源。
- 为 SPA 提供 fallback。
- 拦截 `/api/*`。
- 将 `/api/*` **仅**转发到固定源站 `https://api.startyi.cn`，不得根据客户端参数选择任意目标，避免形成开放代理。
- 转发时保持原始 API path 与 query string。
- 对客户端传入的 `X-Origin-Proxy-Token` 一律不信任；Worker 必须覆盖该 Header，并使用自身 Secret 写入：

```http
X-Origin-Proxy-Token: <ORIGIN_PROXY_SECRET>
```

- 保留必要的请求方法、Body、Cookie、Content-Type 等 Header。
- 将源站响应状态码、Body、Set-Cookie 等正确返回给浏览器。

### 8.2 Worker 禁止做的事情

Worker 中禁止实现：

- 用户注册逻辑
- 登录逻辑
- Session 存储
- 商品业务逻辑
- 购物车业务逻辑
- 订单业务逻辑
- 库存逻辑
- SQL
- MySQL 连接
- 任何数据库事务

所有业务逻辑必须位于 Express 后端。

### 8.3 Wrangler

仓库根目录新增：

```text
wrangler.jsonc
```

配置目标：

- `name` 必须与用户已经创建的 Worker **准确一致**；在未确认名称前不得部署。
- Static Assets 目录：`./dist`
- SPA fallback：`single-page-application`
- `/api/*` 使用 `assets.run_worker_first` 优先进入 Worker。
- `API_ORIGIN=https://api.startyi.cn` 可作为普通 `vars` 配置。
- 使用 `secrets.required` 声明 `ORIGIN_PROXY_SECRET` 为必需 Secret，使部署在缺失 Secret 时直接失败。
- `ORIGIN_PROXY_SECRET` 只从已经存在的 Cloudflare Secret 读取，禁止写入 Git、`.env`、命令行参数或部署文件。
- **不要在 `wrangler.jsonc` 中配置 `route`、`routes` 或 `custom_domain`。** `shop.yirui.io` 已由用户在 Dashboard 手动绑定，Codex 不得让 Wrangler 接管或重建该 Custom Domain。
- 不运行 `wrangler secret put/delete/bulk` 修改现有生产 Secret；只验证所需 Secret 已存在。
- 首次执行需要 Cloudflare 浏览器授权时，Codex 应暂停等待用户完成授权，然后继续部署。

---

## 9. 本地开发网络

本地开发不经过 Cloudflare。

推荐：

```text
Vite
127.0.0.1:5173

Express
127.0.0.1:3000

MySQL
127.0.0.1:3306
```

`vite.config.js` 增加开发代理：

```text
/api/*
→ http://127.0.0.1:3000
```

因此本地前端仍然只写：

```js
fetch('/api/...')
```

开发与生产无需修改 API URL。

生产环境要求 `X-Origin-Proxy-Token`。

本地开发环境允许跳过该校验，但只能在：

```text
NODE_ENV !== production
```

时跳过。

禁止通过硬编码开发 Secret 来绕过生产校验。

---

## 10. 后端规范

后端位于：

```text
backend/
```

采用：

```text
Node.js
Express
JavaScript
mysql2
```

### 10.1 监听

生产环境必须：

```text
127.0.0.1:3000
```

不得监听公网 `0.0.0.0:3000`。

### 10.2 数据库连接

生产 MySQL：

```text
127.0.0.1:3306
```

后端通过 `mysql2/promise` 连接池访问数据库。

禁止 ORM。

SQL 应直接、清晰地保存在数据访问层或对应 service 中，以便课程展示。

### 10.3 Origin Proxy 校验

生产环境中所有 `/api/*` 请求进入业务路由前，应验证：

```http
X-Origin-Proxy-Token
```

其值必须与服务端环境变量：

```text
ORIGIN_PROXY_SECRET
```

一致。

失败返回：

```http
403 Forbidden
```

禁止把 Secret 输出到日志。

### 10.4 错误处理

生产 API：

- 不向客户端返回堆栈。
- 不泄露 SQL。
- 不泄露数据库用户名、密码、连接字符串。
- 统一返回可读但有限的错误结构。

---

## 11. 数据库设计

数据库名称建议：

```text
ecommerce
```

应用账户建议：

```text
ecommerce_app@localhost
```

禁止生产应用使用 MySQL `root`。

第一版至少包含以下表。

### 11.1 `users`

用途：用户账户。

主要字段：

```text
id
username
email
password_hash
created_at
updated_at
```

要求：

- `id` 主键。
- `username` 唯一。
- `email` 唯一。
- 只保存密码哈希，不保存明文密码。

### 11.2 `sessions`

用途：服务端登录 Session。

主要字段：

```text
id
user_id
token_hash
expires_at
created_at
```

要求：

- Session Cookie 保存随机 Token。
- 数据库保存 Token 的哈希，而非原始 Token。
- `token_hash` 必须具有唯一约束/唯一索引，用于安全且高效地定位 Session。
- `user_id` 外键关联 `users.id`。
- 为 `user_id`、`expires_at` 建立合理索引。

### 11.3 `categories`

```text
id
name
```

要求：

- `name` 唯一。

### 11.4 `products`

```text
id
category_id
name
description
price_cents
stock
is_active
created_at
updated_at
```

要求：

- `category_id` 外键关联 `categories.id`。
- 金额统一使用整数“分”，不要使用 JavaScript 浮点数直接表示金额。
- `stock >= 0`。
- 为常用查询字段建立合理索引。

### 11.5 `carts`

```text
id
user_id
created_at
updated_at
```

要求：

- 一个用户最多一个活动购物车。
- `user_id` 唯一并关联 `users.id`。

### 11.6 `cart_items`

```text
cart_id
product_id
quantity
```

要求：

- `cart_id + product_id` 可作为联合主键。
- `quantity > 0`。
- 对应外键指向 `carts` 和 `products`。

### 11.7 `orders`

```text
id
user_id
total_amount_cents
status
created_at
```

要求：

- `user_id` 外键关联 `users.id`。
- `total_amount_cents` 保存下单时计算出的订单总额。

### 11.8 `order_items`

```text
order_id
product_id
quantity
unit_price_cents
```

要求：

- 必须保存下单时商品单价快照 `unit_price_cents`。
- 不得依赖未来可能变化的 `products.price_cents` 还原历史订单。
- 外键关联 `orders` 和 `products`。

---

## 12. 数据库课程知识必须体现

该项目不是“仅仅接一个 MySQL”。

后续实现中应明确体现：

- 主键
- 外键
- 唯一约束
- CHECK / 合理业务约束
- 一对多关系
- 多对多关系拆解
- JOIN
- GROUP BY / 聚合查询
- 索引
- 事务
- 锁 / 并发控制
- EXPLAIN
- 范式设计

SQL 应保持可读，以便课堂展示。

---

## 13. 第一版 API

第一阶段建议实现以下接口。

### 商品

```text
GET /api/products
GET /api/products/:id
GET /api/categories
```

### 用户

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### 购物车

```text
GET    /api/cart
PUT    /api/cart/items/:productId
DELETE /api/cart/items/:productId
```

### 订单

```text
POST /api/orders
GET  /api/orders
GET  /api/orders/:id
```

暂不实现：

- 在线支付
- 退款
- 物流
- 优惠券
- 秒杀
- 商品推荐
- 第三方登录

管理后台不作为第一版部署阻塞项。

---

## 14. 登录与 Session

登录流程：

```text
浏览器
 ↓
POST /api/auth/login
 ↓
Worker
 ↓
Express
 ↓
查询 users
 ↓
验证密码哈希
 ↓
创建随机 Session Token
 ↓
sessions 表保存 token_hash
 ↓
Set-Cookie
 ↓
浏览器
```

Cookie 至少要求：

```text
HttpOnly
Secure
SameSite=Lax
Path=/
```

**不要设置 `Domain` 属性。** Worker 将源站的 `Set-Cookie` 作为 `shop.yirui.io` 的响应返回给浏览器，因此应使用 Host-only Cookie，使 Cookie 只属于：

```text
shop.yirui.io
```

不要设置为 `startyi.cn`，也不要设置为 `.yirui.io`。

退出登录时：

- 删除对应数据库 Session。
- 清除浏览器 Cookie。

过期 Session 应可以被定期或按请求清理。

---

## 15. 下单事务

下单必须使用数据库事务。

核心流程：

```text
BEGIN
 ↓
读取并校验购物车商品
 ↓
校验库存
 ↓
创建 orders
 ↓
创建 order_items
 ↓
扣减 products.stock
 ↓
清空对应 cart_items
 ↓
COMMIT
```

任意一步失败：

```text
ROLLBACK
```

库存更新必须防止出现负库存。

不能采用：

```text
先 SELECT stock
然后无条件 UPDATE stock = stock - quantity
```

而应使用能够抵抗并发超卖的方案，例如条件更新、行锁或课程阶段适合的事务控制方式。

这是项目中最重要的数据库事务案例之一。

---

## 16. 环境变量

### Backend

生产服务器环境变量至少包括：

```text
NODE_ENV=production
HOST=127.0.0.1
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ecommerce
DB_USER=ecommerce_app
DB_PASSWORD=...

ORIGIN_PROXY_SECRET=...
SESSION_COOKIE_NAME=...
SESSION_TTL_DAYS=...
```

不要把真实值提交到 Git。

生产 ECS 已存在：

```text
/etc/ecommerce/backend.env
```

该文件当前为 `root:root`、权限 `0600`，并已包含真实 `ORIGIN_PROXY_SECRET`。后续配置必须遵循：

- 不删除或整体覆盖该文件。
- 不重新生成 `ORIGIN_PROXY_SECRET`。
- 不使用 `cat` 等方式把完整文件内容输出到终端或日志。
- 添加 `DB_*`、Session 等变量时，使用不会泄露现有 Secret 的安全更新方式。
- 最终继续保持 `root:root` 和 `0600`。

允许提交：

```text
backend/.env.example
```

其中只放变量名和示例占位符。

### Cloudflare Worker

普通配置可包含：

```text
API_ORIGIN=https://api.startyi.cn
```

Secret：

```text
ORIGIN_PROXY_SECRET
```

只能从 Cloudflare Secret 读取。

---

## 17. Nginx

Codex 可以检查并修改服务器上的项目相关 Nginx 配置，但必须：

- 保留现有其他站点。
- 修改前先阅读现有配置。
- 不删除与本项目无关的 server block。
- 不更改现有证书体系。
- **不得运行 Certbot 申请、替换、扩展或重签证书。**
- `api.startyi.cn` 必须直接复用已存在且已覆盖该域名的证书：
  - `/etc/letsencrypt/live/startyi.cn/fullchain.pem`
  - `/etc/letsencrypt/live/startyi.cn/privkey.pem`
- 不修改 `startyi.cn` 和 `calcx.startyi.cn` 现有 server block，除非用户另行明确授权。
- 每次修改后先执行：

```bash
sudo nginx -t
```

测试通过后才能 reload。

目标数据流：

```text
api.startyi.cn:443
      ↓
Nginx
      ↓
http://127.0.0.1:3000
```

Nginx 只负责：

- TLS 终止
- Host / Forwarded Header
- 反向代理
- 合理的请求体大小和超时

不要在 Nginx 中实现应用业务逻辑。

---

## 18. systemd

后端生产进程使用 systemd，不使用 PM2。

服务目标：

```text
ecommerce.service
```

要求：

- 使用非 root 用户运行。
- 工作目录指向部署后的 `backend/`。
- `ExecStart` 启动 Node 应用。
- 环境变量固定通过现有 `/etc/ecommerce/backend.env` 读取。
- systemd 可由 PID 1 在降权启动应用前读取 `root:root 0600` 的 EnvironmentFile；不要为了非 root 应用用户而放宽该文件权限。
- `Restart=on-failure`。
- 不把数据库密码直接写进 service 文件并提交到 Git。

Codex 可以生成仓库内的模板：

```text
deploy/ecommerce.service.example
```

但真实服务器路径应在部署前根据实际环境确认。

---

## 19. MySQL 生产约束

生产环境：

```text
MySQL → 127.0.0.1:3306
```

不得：

```text
0.0.0.0:3306
```

应用使用：

```text
ecommerce_app@localhost
```

权限只覆盖本项目数据库所需操作。

不要给予：

```text
GRANT ALL ON *.*
```

数据库初始化由：

```text
database/schema.sql
database/seed.sql
```

完成。

初始商品应尽量迁移自当前：

```text
src/data/products.js
```

---

## 20. 部署顺序

Codex 应按照以下顺序执行，不要跨阶段大规模修改。

### Phase 0：只读预检

在修改代码或服务器前先完成：

- `git status`，确认并保护用户当前未提交修改。
- 确认用户已创建 Worker 的准确名称；未确认前不得写入最终 `wrangler.jsonc` 的 `name` 或执行部署。
- 只读检查 ECS 上 Node.js、npm、MySQL、Nginx、systemd 的现状和版本，缺失项在真正安装前明确报告。
- 只读检查现有 Nginx 站点结构，确认不会覆盖 `startyi.cn`、`calcx.startyi.cn` 等现有站点。
- 确认现有证书路径存在并覆盖 `api.startyi.cn`；不得运行 Certbot。
- 确认 `/etc/ecommerce/backend.env` 存在、权限仍为 `root:root 0600`；只检查文件和权限，不输出其中 Secret。

### Phase 1：前端基础改造

- 保留现有 UI。
- Router 改为 History Mode。
- 增加 Vite `/api` 开发代理。
- 移除 GitHub Pages 专用 base 路径依赖。
- 删除或放弃未跟踪的 GitHub Pages workflow。
- 保证现有测试仍可运行。

### Phase 2：数据库

- 创建 `database/schema.sql`。
- 创建 `database/seed.sql`。
- 将静态商品迁移为 seed 数据。
- 明确外键、唯一约束和索引。

### Phase 3：Backend

- 创建 `backend/`。
- 配置 Express。
- 配置 `mysql2/promise` 连接池。
- 增加统一错误处理。
- 实现生产 Origin Proxy Token 校验。
- 实现商品 API。

### Phase 4：认证

- 注册。
- 登录。
- Session。
- Cookie。
- `/api/auth/me`。
- 退出。

### Phase 5：购物车

- 保留游客 localStorage。
- 登录用户改用数据库购物车。
- 必要时实现购物车合并。

### Phase 6：订单

- 创建订单。
- 事务扣库存。
- 保存价格快照。
- 查询历史订单。

### Phase 7：Cloudflare Worker

- 新增 Worker 代理逻辑。
- 新增 Static Assets 配置。
- 新增 SPA fallback。
- `/api/*` 注入并**覆盖** `X-Origin-Proxy-Token`。
- 固定代理目标为 `https://api.startyi.cn`，保留 path/query，不允许客户端指定代理目标。
- `wrangler.jsonc` 声明 `ORIGIN_PROXY_SECRET` 为 required secret。
- `wrangler.jsonc` 不配置 `route`、`routes` 或 `custom_domain`。
- 不在 Worker 中添加业务逻辑。

### Phase 8：ECS 部署

- 先依据 Phase 0 结果补齐必要的 Node.js / MySQL 等生产依赖，不盲目重装已有组件。
- 部署 backend。
- 初始化/迁移 MySQL。
- 创建/配置专用数据库账户。
- 在**保留现有 `ORIGIN_PROXY_SECRET`** 的前提下补充 `/etc/ecommerce/backend.env` 所需变量。
- 安装生产依赖。
- 配置 systemd，使用 `/etc/ecommerce/backend.env`。
- 新建项目专用 `api.startyi.cn` Nginx server block，复用已有证书，不运行 Certbot。
- 验证 `127.0.0.1:3000`。
- 验证 MySQL 只监听本机。
- 验证公网安全组仍未开放 `3000`、`3306`。

### Phase 9：Cloudflare 代码部署

- `npm run build`
- 如尚未安装，则在项目内安装 Wrangler。
- 确认 `wrangler.jsonc` 的 `name` 与用户已创建 Worker 完全一致。
- 如首次 Wrangler 操作触发浏览器授权，暂停并让用户亲自完成授权。
- 部署 Worker + Static Assets 到用户已经创建好的 Worker。
- 不新建 Worker。
- 不运行 Secret 创建/删除命令。
- 不修改 DNS。
- 不修改或重建 Custom Domain。

### Phase 10：端到端验证

依次验证：

```text
首页
商品列表
商品详情
注册
登录
刷新保持登录
购物车
下单
库存减少
订单历史
退出
```

还需验证：

```text
https://shop.yirui.io/api/products
```

工作正常，而绕开 Worker 直接访问：

```text
https://api.startyi.cn/api/products
```

在没有合法 `X-Origin-Proxy-Token` 时返回 `403`。

---

## 21. 测试要求

不能以“页面能打开”作为部署成功标准。

至少保留并扩展：

### 单元测试

- 购物车纯函数。
- 金额计算。
- 必要的业务工具函数。

### API 测试

至少覆盖：

- 注册成功 / 重复用户。
- 登录成功 / 密码错误。
- 未登录访问受保护接口。
- 商品查询。
- 购物车更新。
- 库存不足下单。
- 成功下单。
- 事务失败回滚。

### E2E

继续使用 Playwright，覆盖最核心用户路径。

---

## 22. 安全底线

Codex 在任何实现中都必须遵守：

- 密码只能保存哈希。
- SQL 使用参数化查询。
- 不拼接用户输入生成 SQL。
- Session Token 使用密码学安全随机数。
- 数据库优先保存 Session Token 哈希。
- Cookie 使用 `HttpOnly`、`Secure`、`SameSite=Lax`。
- 生产错误不泄露堆栈和数据库细节。
- `ORIGIN_PROXY_SECRET` 不进入浏览器、不进入 Git。
- 数据库密码不进入 Git。
- MySQL 不开放公网。
- Express 生产环境只监听 `127.0.0.1`。
- 不关闭 TLS 校验。
- 不为了“部署方便”削弱安全组、防火墙或认证。
- 不修改本项目无关的服务器服务或网站。

---

## 23. Git 与部署纪律

Codex 在执行任务时：

- 先检查 `git status`。
- 不覆盖用户现有未提交修改。
- 不擅自提交 Git，除非用户明确要求。
- 不 force push。
- 不重写历史。
- 不把 `.env`、Secret、数据库转储等敏感文件加入版本控制。
- 每个阶段尽量保持修改范围小且可验证。
- 先测试，再进入下一阶段。

当前已知：

- `README.md` 存在未暂存修改。
- `.github/workflows/deploy-pages.yml` 当前未跟踪。

处理时必须避免覆盖用户现有 `README.md` 修改。

---

## 24. 不属于 Codex 职责的事项

Codex 不执行：

- Cloudflare Dashboard 中创建 Worker。
- Cloudflare Custom Domain 绑定、删除或重建。
- Cloudflare 生产 Secret 的创建、删除或轮换。
- DNS 记录创建或修改。
- 域名注册、转移。
- ICP 备案。
- Certbot 证书申请、扩展、替换或重签。
- 阿里云安全组修改。
- 云服务账号权限调整。
- 支付平台申请。
- 手动输入或回显真实密码、Token、私钥。
- 修改与本项目无关的服务器配置。

首次 Wrangler 浏览器授权属于用户交互步骤：Codex 可以发起授权流程，但必须由用户本人在浏览器中确认。

这些事项如需要变化，应由用户手动处理后，再继续自动化部署。

---

## 25. 完成标准

只有同时满足以下条件，才可认为第一版部署完成：

1. `https://shop.yirui.io` 可公网访问。
2. Vue Router 使用正常的 History URL。
3. 静态资源由 Cloudflare 提供。
4. 浏览器只访问同源 `/api/*`。
5. Worker 正确代理到 `api.startyi.cn`。
6. `api.startyi.cn` 无合法 Origin Token 时拒绝业务 API。
7. Express 只监听 `127.0.0.1:3000`。
8. MySQL 只监听本机且使用专用应用账户。
9. 商品来自 MySQL。
10. 注册和登录真实写入/读取数据库。
11. 密码不以明文存储。
12. 登录状态可跨刷新保持。
13. 登录用户购物车可以持久化。
14. 下单使用事务。
15. 下单后库存正确变化。
16. 订单历史可以查询。
17. 现有核心前端体验没有因后端改造而明显退化。
18. 单元测试、关键 API 测试和核心 E2E 通过。
19. Git 中不存在密码、Secret 或生产环境敏感值。
20. `api.startyi.cn` 使用现有 Let's Encrypt 证书正常提供 HTTPS，且未重新签发证书。
21. `shop.yirui.io` 仍使用用户已经手动绑定的 Custom Domain，没有被 Wrangler 重建或替换。
22. `/etc/ecommerce/backend.env` 中原有 `ORIGIN_PROXY_SECRET` 未被覆盖或泄露，最终权限仍为 `root:root 0600`。
23. 未破坏服务器上的其他站点。

---

## 26. Codex 执行原则

本项目采用“渐进式改造”，不是重写。

当代码现状与本文档冲突时：

1. 优先保留用户已有有效实现。
2. 在不改变总体架构的前提下选择最小修改方案。
3. 不自行更换框架、数据库或部署平台。
4. 不因为某一步更方便而绕过本文档中的安全边界。
5. 如确实需要改变核心架构，停止并先向用户说明原因。

最终架构固定为：

```text
shop.yirui.io
      ↓
Cloudflare Worker + Static Assets
      ↓ /api/*
api.startyi.cn
      ↓
Nginx
      ↓
Express
      ↓
MySQL
```

除用户明确授权外，不再引入其他生产链路。
