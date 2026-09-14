# 生产运维手册

> 生产 SSH alias：`aliyun-agent`，远端用户 `agent`。本文命令默认从维护者工作站执行；涉及管理员的命令会明确标注。不要在诊断输出中打印环境变量、Cookie、Secret 或数据库密码。

## 当前健康基线

2026-09-14 核验结果：

- `ecommerce.service`：enabled、active/running；
- Nginx：enabled、active，配置测试通过；
- MySQL：enabled、active；
- `shop.yirui.io/`：HTTP 200；
- History 路由：HTTP 200；
- `shop.yirui.io/api/products`：HTTP 200；
- 无代理凭据直连 `api.startyi.cn/api/products`：HTTP 403；
- Express 只监听 `127.0.0.1:3000`；
- MySQL 只监听 `127.0.0.1:3306` 和 `127.0.0.1:33060`。

项目当前没有单独的 `/health` endpoint；商品列表 API 是现有的只读应用健康检查。它会同时覆盖 Worker、Nginx、Express 和 MySQL 链路。

## 快速健康检查

### 公网链路

```sh
curl --silent --show-error --output /dev/null --write-out 'home=%{http_code}\n' https://shop.yirui.io/
curl --silent --show-error --output /dev/null --write-out 'products=%{http_code}\n' https://shop.yirui.io/api/products
curl --silent --show-error --output /dev/null --write-out 'origin_without_token=%{http_code}\n' https://api.startyi.cn/api/products
```

期望状态依次为 200、200、403。源站 403 是安全边界正常工作，不是故障。

### ECS 服务和监听

```sh
ssh aliyun-agent "systemctl is-enabled ecommerce.service"
ssh aliyun-agent "systemctl is-active ecommerce.service"
ssh aliyun-agent "systemctl is-active nginx"
ssh aliyun-agent "systemctl is-active mysql"
ssh aliyun-agent "readlink -f /srv/ecommerce/current"
ssh aliyun-agent "ss -lnt"
```

重点检查：80/443 由 Nginx 对外监听，3000/3306/33060 只能出现在 `127.0.0.1`。当前 `current` 应指向 `/srv/ecommerce/releases/20260914T074610Z-cd978d293850`；后续发布完成后应更新本文的状态快照。

## 后端重启

日常重启只能使用受限包装脚本：

```sh
ssh aliyun-agent "sudo -n /usr/local/sbin/ecommerce-safe-restart"
```

脚本只执行 `systemctl restart ecommerce.service` 并验证服务恢复 active。成功后继续检查：

```sh
ssh aliyun-agent "systemctl is-active ecommerce.service"
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' https://shop.yirui.io/api/products
```

不要改用 `sudo systemctl restart ecommerce.service`；该直接命令不在 `agent` 的 sudo 白名单中。

## Nginx 检查与 reload

管理员更新 Nginx 配置后，`agent` 可以执行：

```sh
ssh aliyun-agent "sudo -n /usr/sbin/nginx -t"
ssh aliyun-agent "sudo -n /usr/bin/systemctl reload nginx"
```

只有第一条明确报告 syntax ok 和 test successful 后才能执行 reload。当前站点文件是 `/etc/nginx/sites-available/api.startyi.cn`，enabled link 是 `/etc/nginx/sites-enabled/api.startyi.cn`；不得为方便修改其他 server block。

## 日志

### Express / systemd

`agent` 可进行有限查看：

```sh
ssh aliyun-agent "journalctl -u ecommerce.service -n 100 --no-pager --output=short-iso"
ssh aliyun-agent "journalctl -u ecommerce.service --since '15 minutes ago' --no-pager --output=short-iso"
```

`agent` 不在 `adm` 或 `systemd-journal` 组，journalctl 会提示看不到其他用户或系统消息。应用自身启动、退出和错误类型日志当前可见；需要完整 journal 时，由 ECS 管理员执行：

```sh
sudo journalctl -u ecommerce.service -n 200 --no-pager --output=short-iso
```

Express 对未预期异常只记录 `[api-error] <ErrorName>`，不会把数据库详情返回给客户端。若只看到通用错误，应结合请求时间、服务状态和管理员可见日志定位，不要临时把 Secret 或异常对象全部打印出来。

### Nginx

日志文件是 `/var/log/nginx/access.log` 和 `/var/log/nginx/error.log`，当前为 `www-data:adm`、`0640`；`agent` 不具备读取权限。由管理员按最小范围查看：

```sh
sudo tail -n 100 /var/log/nginx/error.log
sudo tail -n 100 /var/log/nginx/access.log
```

### Cloudflare Worker

Observability 已启用，生产 Worker Events / Logs 在 Cloudflare Dashboard 查看。CLI 已授权时也可使用：

```sh
npx wrangler tail shop
```

CLI 未授权时使用 device flow 并由用户亲自完成浏览器授权；不要使用临时账户或读取 Wrangler 凭据文件。

### MySQL

MySQL 服务和数据库级日志由 ECS 管理员查看。应用账户没有管理权限，不要通过提高 `ecommerce_app` 权限来完成诊断。

## 日常发布

- Worker/静态前端：构建、dry-run、`wrangler deploy`，再核验 Custom Domain、公开入口和 Observability。
- Express：创建新 release、运行安装脚本、原子切换 `current`、执行安全重启。
- Nginx：管理员更新配置，`agent` 只做 `nginx -t` 和 reload。
- MySQL schema：管理员审核并手动执行，不随应用 release 自动变更。

完整命令见 [生产部署](deployment.md)。

## 回滚后端 release

回滚只改变 Express 代码和依赖，不会撤销已经执行的数据库 DDL 或业务数据。因此先确认目标旧 release 与当前 schema 兼容。

1. 只读确认当前和可选 release：

   ```sh
   ssh aliyun-agent "readlink -f /srv/ecommerce/current"
   ssh aliyun-agent "find /srv/ecommerce/releases -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort"
   ```

2. 明确选定一个已经存在于 `/srv/ecommerce/releases/` 下的完整 release。不要使用模糊 glob，也不要删除当前 release。

3. 用该 release 自带的安装脚本重新安装、测试并原子切换。以下 `<release-id>` 必须替换成上一步核对过的精确目录名：

   ```sh
   ssh aliyun-agent "bash /srv/ecommerce/releases/<release-id>/deploy/install-backend-release.sh /srv/ecommerce/releases/<release-id>"
   ```

4. 重启并验证：

   ```sh
   ssh aliyun-agent "sudo -n /usr/local/sbin/ecommerce-safe-restart"
   ssh aliyun-agent "systemctl is-active ecommerce.service"
   curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' https://shop.yirui.io/api/products
   ```

5. 确认 `readlink -f /srv/ecommerce/current` 指向选定 release，并记录回滚原因和实际版本。

当前只有一个 release 目录，因此现阶段没有第二个现成版本可供回滚；首次后续发布后才会形成旧 release。不要为了“准备回滚”复制或伪造 release。

## Worker 回滚

Worker 版本回退通过 Cloudflare 的现有 Worker `shop` 执行，必须由具备 Cloudflare 权限的人确认目标版本。回退不得创建新 Worker、改动 Secret、DNS、Custom Domain、route、`workers.dev`、Preview URLs 或 Observability。完成后执行完整公网检查并在 Dashboard 复核配置。

## 常见状态判断

| 现象 | 首先检查 |
| --- | --- |
| 首页与静态资源失败 | Worker 部署、Custom Domain、Static Assets 和 Cloudflare Events |
| 首页正常但 `/api/products` 失败 | Worker proxy、源站 TLS、Nginx、Express、MySQL |
| 直连 `api.startyi.cn/api/products` 为 403 | 正常；说明 Origin Proxy 校验生效 |
| 直连源站或同源 API 为 500 | `ecommerce.service` 日志、数据库连接和生产环境变量是否完整；不得输出变量值 |
| `ecommerce.service` inactive | journal、MySQL active 状态、`current` 链接和 Node runtime |
| Nginx reload 失败 | 保持当前进程，不重复 reload；先修复并重新通过 `nginx -t` |
| 登录后刷新丢失 | Cookie 属性、Session 行和 Worker Cookie 转发 |
| 下单库存异常 | 订单事务日志、`orders/order_items/products/cart_items` 一致性；不要直接补写数据掩盖问题 |

## 证书与备份边界

Nginx 当前复用：

```text
/etc/letsencrypt/live/startyi.cn/fullchain.pem
/etc/letsencrypt/live/startyi.cn/privkey.pem
```

`agent` 无权读取证书私钥，也不负责运行 Certbot。证书续期机制和生产数据库备份/恢复自动化未在当前仓库中实现或记录为已验证状态；这两项由管理员维护，不能假设应用发布会自动处理。

[返回项目入口](../README.md) · [部署](deployment.md) · [数据库](database.md) · [安全](security.md)
