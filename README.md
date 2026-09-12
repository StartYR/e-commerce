# 拾页 · 文具小店

数据库课程项目的第一版：使用 Vue 3、Vite 和 JavaScript 实现一个文具商店前端。商品来自本地数据文件，购物车保存在当前浏览器中。当前没有后端、数据库、账号、订单或支付功能。

## 本地启动

需要 Node.js 22.12 或更高版本，使用 npm 管理依赖。

```sh
npm install
npm run dev
```

在浏览器打开终端显示的本地地址，一般为 http://127.0.0.1:5173。停止服务时在终端按 `Ctrl+C`。

## 已有功能

- 12 件示例商品，分为纸本手帐、书写工具、桌面小物和收纳随行。
- 商品分类、名称及描述搜索、价格升降序排列。
- 加入购物车、合并相同商品、修改数量、移除商品、自动计算总价。
- 购物车刷新后保留；数量限定为 1–99 的整数；处理失效商品和损坏的保存数据。
- 空购物车、搜索无结果、添加反馈和保存失败提示。
- 适配电脑与手机，支持键盘操作和减少动态效果设置。
- 商品插画和图标均为项目内的 SVG，无需第三方图片或字体服务。

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

页面使用 `/#/` 和 `/#/cart` 两个地址，因此静态预览时可以直接刷新购物车页面。

## 构建与检查

```sh
npm test
npm run build
npm run test:e2e
```

- `npm test`：检查购物车数据恢复、数量限制和金额计算。
- `npm run build`：生成 `dist/` 目录。
- `npm run test:e2e`：通过 Playwright 自动启动构建产物的本地预览，检查桌面与手机尺寸下的选购流程。先执行构建；测试默认使用本机安装的 Google Chrome。使用 Edge 时，可在 PowerShell 中先执行 `$env:PLAYWRIGHT_CHANNEL = 'msedge'`。
- `npm run preview`：手动预览构建结果。

## 后续课程扩展

学到数据库后，可以增加 Node.js + Express 后端，把本地商品数据改为从 MySQL 读取，再逐步实现商品管理和订单。前端页面与商品数据、购物车逻辑已分别放在独立文件中，便于逐步接入。
