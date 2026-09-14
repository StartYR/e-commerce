# 拾页 · 文具小店

数据库课程项目：前端使用 Vue 3、Vite 和 JavaScript，后端使用 Node.js、Express 和 `mysql2`。商品业务数据来自 MySQL，浏览器通过同源 `/api/*` 获取商品、认证和登录购物车数据；游客购物车仍保存在浏览器中。订单和支付功能尚未实现。

## 本地启动

需要 Node.js 22.12 或更高版本，使用 npm 管理依赖。

```sh
npm install
npm run dev
```

在浏览器打开终端显示的本地地址，一般为 http://127.0.0.1:5173。停止服务时在终端按 `Ctrl+C`。

后端是位于 `backend/` 的独立 npm 包。本地开发会读取被 Git 忽略的 `backend/.env`，变量名和占位示例见 [backend/.env.example](backend/.env.example)。管理员初始化使用 MySQL `ecommerce-setup` login-path，管理员密码不会写入项目；应用运行始终使用 `.env` 中的 `ecommerce_app`：

```sh
npm --prefix backend install
npm --prefix backend run db:setup
npm --prefix backend run dev
```

另开一个终端运行根目录的 `npm run dev`。初始化脚本依次执行 `database/schema.sql`、`database/seed.sql`，并创建或更新只有本项目数据库 DML 权限的 `ecommerce_app@localhost`。

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
- 登录用户购物车写入 MySQL，游客购物车继续使用 `localStorage`；退出登录后恢复游客购物车。

游客购物车仅在相同浏览器、相同网站地址下保存；登录购物车由数据库持久化。演示商品及价格不代表实际在售商品。

## 从哪里修改

| 文件 | 内容 |
| --- | --- |
| [src/data/products.js](src/data/products.js) | 仅包含商品插画、颜色、徽标和展示顺序映射，不保存商品业务数据 |
| [src/composables/useCatalog.js](src/composables/useCatalog.js) | 从同源商品 API 加载名称、描述、分类、价格和库存 |
| [src/views/ShopView.vue](src/views/ShopView.vue) | 商店首页、搜索与分类 |
| [src/views/CartView.vue](src/views/CartView.vue) | 购物车页面 |
| [src/composables/useCart.js](src/composables/useCart.js) | 游客本地购物车与登录数据库购物车切换逻辑 |
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
npm --prefix backend run test:db
npm run test:live
```

- `npm test`：检查前端购物车纯函数和不依赖真实数据库的后端 API、配置与 SQL 参数化行为。
- `npm run build`：生成 `dist/` 目录。
- `npm run test:e2e`：通过 Playwright 自动启动构建产物的本地预览，检查桌面与手机尺寸下的选购流程。先执行构建；测试默认使用本机安装的 Google Chrome。使用 Edge 时，可在 PowerShell 中先执行 `$env:PLAYWRIGHT_CHANNEL = 'msedge'`。
- `npm --prefix backend run test:db`：使用 `backend/.env` 中的应用账户，真实验证商品、注册、登录、Session 和购物车 API。
- `npm run test:live`：自动启动真实后端和 Vite，通过浏览器验证 MySQL 商品、认证和登录购物车流程。
- `npm run preview`：手动预览构建结果。

## 部署目标

`npm run build` 生成可部署的 `dist/` 目录，构建不依赖 GitHub Pages 的 `/e-commerce/` 子路径。

最终部署架构以 [deployment-plan.md](deployment-plan.md) 为准：前端静态资源由 Cloudflare Worker + Static Assets 提供，浏览器通过同源 `/api/*` 访问后端。当前数据库初始化仅针对本机开发环境，生产部署仍在后续阶段完成。

## 后续课程扩展

后续阶段将实现订单创建、库存事务扣减和订单历史。商品业务数据、展示元数据与购物车逻辑已分别放在独立文件中。
