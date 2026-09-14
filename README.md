# 拾页 · 文具小店

数据库课程项目：前端使用 Vue 3、Vite 和 JavaScript，后端使用 Node.js、Express 和 `mysql2`。当前前端仍从本地数据文件读取商品并把游客购物车保存在浏览器中；仓库已经包含 MySQL schema、seed、商品 API 和 Session 账号认证，但数据库尚未部署，数据库购物车、订单和支付功能尚未实现。

## 本地启动

需要 Node.js 22.12 或更高版本，使用 npm 管理依赖。

```sh
npm install
npm run dev
```

在浏览器打开终端显示的本地地址，一般为 http://127.0.0.1:5173。停止服务时在终端按 `Ctrl+C`。

后端是位于 `backend/` 的独立 npm 包。它从运行环境读取数据库和 Origin Proxy 配置，不会自动加载仓库内的 `.env` 文件。准备好本地 MySQL 并配置 [backend/.env.example](backend/.env.example) 中列出的变量后，可运行：

```sh
npm --prefix backend install
npm --prefix backend run dev
```

## 已有功能

- 12 件示例商品，分为纸本手帐、书写工具、桌面小物和收纳随行。
- 商品分类、名称及描述搜索、价格升降序排列。
- 加入购物车、合并相同商品、修改数量、移除商品、自动计算总价。
- 购物车刷新后保留；数量限定为 1–99 的整数；处理失效商品和损坏的保存数据。
- 空购物车、搜索无结果、添加反馈和保存失败提示。
- 适配电脑与手机，支持键盘操作和减少动态效果设置。
- 商品插画和图标均为项目内的 SVG，无需第三方图片或字体服务。
- 后端提供商品、单件商品和分类查询 API；生产模式会先验证来自 Cloudflare Worker 的 Origin Proxy Token。
- 注册和登录密码使用 Argon2id 哈希，服务端只保存 Session Token 哈希；生产 Cookie 为 Host-only、HttpOnly、Secure、SameSite=Lax。

购物车仅在相同浏览器、相同网站地址下保存；清除浏览器数据后会丢失，不在不同设备之间同步。演示商品及价格不代表实际在售商品。

## 从哪里修改

| 文件 | 内容 |
| --- | --- |
| [src/data/products.js](src/data/products.js) | 商品名称、描述、分类、价格和插画类型；价格单位为分 |
| [src/views/ShopView.vue](src/views/ShopView.vue) | 商店首页、搜索与分类 |
| [src/views/CartView.vue](src/views/CartView.vue) | 购物车页面 |
| [src/composables/useCart.js](src/composables/useCart.js) | 购物车状态和浏览器保存逻辑 |
| [src/lib/cart.js](src/lib/cart.js) | 数量校验、恢复数据和金额计算 |
| [src/components/ProductArt.vue](src/components/ProductArt.vue) | 商品 SVG 插画 |
| [src/style.css](src/style.css) | 网站颜色、布局和手机适配 |
| [backend/src](backend/src) | Express 入口、配置、数据库访问、中间件和 API 路由 |
| [src/composables/useAuth.js](src/composables/useAuth.js) | 前端登录状态和同源认证 API 调用 |
| [src/views/LoginView.vue](src/views/LoginView.vue) | 登录页面 |
| [src/views/RegisterView.vue](src/views/RegisterView.vue) | 注册页面 |
| [database/schema.sql](database/schema.sql) | MySQL 表、约束、外键和索引 |
| [database/seed.sql](database/seed.sql) | 分类、商品和固定初始库存 |

页面使用 `/` 和 `/cart` 两个 History 路由地址。部署静态资源时，托管层需要为这些前端路由提供 SPA fallback。

## 构建与检查

```sh
npm test
npm run build
npm run test:e2e
```

- `npm test`：检查前端购物车纯函数和不依赖真实数据库的后端 API、配置与 SQL 参数化行为。
- `npm run build`：生成 `dist/` 目录。
- `npm run test:e2e`：通过 Playwright 自动启动构建产物的本地预览，检查桌面与手机尺寸下的选购流程。先执行构建；测试默认使用本机安装的 Google Chrome。使用 Edge 时，可在 PowerShell 中先执行 `$env:PLAYWRIGHT_CHANNEL = 'msedge'`。
- `npm run preview`：手动预览构建结果。

## 部署目标

`npm run build` 生成可部署的 `dist/` 目录，构建不依赖 GitHub Pages 的 `/e-commerce/` 子路径。

最终部署架构以 [deployment-plan.md](deployment-plan.md) 为准：前端静态资源由 Cloudflare Worker + Static Assets 提供，浏览器通过同源 `/api/*` 访问后端。Worker、后端和数据库将在后续阶段加入。

## 后续课程扩展

后续阶段将把前端商品数据源切换到现有 API，并继续实现数据库购物车和事务订单。前端页面与商品数据、购物车逻辑已分别放在独立文件中，便于渐进式接入。
