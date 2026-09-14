# 拾页 · 文具小店

一个已经投入生产运行的数据库课程电子商务项目。项目采用 Vue 3 单页前端、Cloudflare Worker 边缘入口、Express API、Nginx 源站代理和 MySQL 8.4；商品、账户、Session、登录购物车与订单均由 MySQL 持久化。当前版本没有真实支付、退款或物流流程。

- 正式网站：<https://shop.yirui.io>
- 后端源站：`https://api.startyi.cn`（只接受 Worker 注入的源站代理凭据，浏览器不应直接调用）
- Worker 名称：`shop`

## 组件边界

| 组件 | 当前职责 |
| --- | --- |
| Cloudflare Worker | 提供构建后的 Static Assets；将同源 `/api/*` 固定代理到 `api.startyi.cn` |
| Vue 前端 | History 路由、页面交互、游客本地购物车和同源 API 客户端 |
| Express 后端 | 商品、认证、Session、登录购物车与订单业务逻辑 |
| Nginx | `api.startyi.cn` 的 TLS 入口并反向代理至 `127.0.0.1:3000` |
| MySQL | 保存全部业务数据并提供事务、约束、外键与索引 |
| systemd | 以受限账户 `agent` 运行和守护 Express 服务 |

完整生产链路：`shop.yirui.io → Worker → api.startyi.cn → Nginx → Express → MySQL`。

## 文档入口

| 文档 | 内容 |
| --- | --- |
| [架构](docs/architecture.md) | 系统组件、请求链路、代码结构、API 与数据归属 |
| [部署](docs/deployment.md) | 当前生产拓扑、发布流程、路径、端口和职责划分 |
| [数据库](docs/database.md) | 表关系、索引、外键、Session 与下单事务 |
| [运维](docs/operations.md) | 重启、reload、日志、健康检查、故障定位和回滚 |
| [安全](docs/security.md) | 信任边界、Secret、Cookie、数据库权限和 `agent` sudo 白名单 |
| [初始部署计划（历史）](docs/history/initial-deployment-plan.md) | Phase 0–10 实施前的计划，仅供追溯 |

## 本地开发

要求 Node.js `>=22.12.0`、npm 和 MySQL 8.4。真实配置写入被 Git 忽略的 `backend/.env`，变量名及占位说明见 [backend/.env.example](backend/.env.example)。不要将密码或 Secret 写入仓库。

```sh
npm install
npm --prefix backend install
npm --prefix backend run db:setup
npm --prefix backend run dev
```

另开终端启动 Vite：

```sh
npm run dev
```

Vite 通过开发代理把 `/api/*` 转发到 `http://127.0.0.1:3000`。数据库初始化默认使用本机 MySQL login-path `ecommerce-setup`；应用运行只使用 `ecommerce_app` 限权账户。

## 构建与验证

```sh
npm test
npm run build
npm run test:e2e
npm --prefix backend run test:db
npm run test:live
```

生产发布和回滚不得只依据本页操作，请遵循 [部署文档](docs/deployment.md) 与 [运维文档](docs/operations.md)。
