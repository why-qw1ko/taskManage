# 序日 Dayflow

序日是我做的一个个人任务管理工具，把待办、日历和专注计时放在同一个页面里。数据保存在一个 SQLite 文件中，可以在自己的电脑上用，也可以放到服务器上运行。

## 能做什么

- 用列表、看板或日历管理任务，看板支持拖动切换状态。
- 给任务添加截止日期、优先级、备注、标签和子任务。
- 按清单整理待办，查看今天、最近 7 天、重要任务和已完成事项。
- 搜索任务，按优先级筛选，按创建时间或截止日期排序。
- 选择任务开始专注计时，支持 15、25、45、60 分钟。
- 导入、导出 JSON 备份，切换浅色和深色主题。

## 截图

截图中的内容是项目自带的示例数据。

### 列表

![序日 Dayflow 列表视图](docs/screenshots/dayflow-list.jpg)

### 看板

![序日 Dayflow 看板视图](docs/screenshots/dayflow-board.jpg)

### 日历

![序日 Dayflow 日历视图](docs/screenshots/dayflow-calendar.jpg)

## 本地运行

需要 **Node.js 22.12.0 或更高版本**和 npm。SQLite 使用 Node.js 内置模块，不用另外安装数据库服务。

```bash
git clone https://github.com/why-qw1ko/taskManage.git
cd taskManage
npm ci
npm run dev
```

打开终端显示的地址，默认是 `http://localhost:3000`。首次访问会自动建库；空数据库会载入示例任务，可以在「设置与数据」中清除。

安装依赖时需要联网。锁文件中的部分下载地址使用 npm 镜像，安装失败时请检查对应地址是否能访问。项目通过 `.npmrc` 禁用了依赖包的安装脚本。

构建并运行：

```bash
npm run build
npm start
```

`npm start` 默认监听 `127.0.0.1:3000`，可用环境变量 `PORT` 修改端口。请在项目根目录运行，保留 `dist/`、`node_modules/` 和 `migrations/`。开发和构建后的服务默认使用同一个数据库。

Node.js 22.12 可能显示 SQLite 实验性功能提示，启动命令已包含所需参数。按 `Ctrl+C` 停止服务。

## 放到服务器上

目前是单用户应用，没有登录和账号隔离。所有访问者共用一份数据，公网部署需要在反向代理等入口加上访问认证。

### 配置访问地址

数据接口默认只允许本机地址。通过 IP 或域名访问时，在项目根目录新建 `.env.production`，填入浏览器实际访问的地址：

```dotenv
DAYFLOW_ALLOWED_ORIGINS=http://192.168.1.50:3000
```

替换示例中的 IP 和端口，不要加 `/api/data` 或其他路径。多个地址用英文逗号分隔；协议和端口需要匹配，不支持 `*`。修改配置后重启服务。开发模式可使用 `.env.local`。

如果在内网直接通过 IP 访问，需要同时监听网卡：

```bash
node --experimental-sqlite node_modules/vinext/dist/cli.js start --hostname 0.0.0.0
```

### Nginx + HTTPS

以 `https://dayflow.example.com` 为例，在 `.env.production` 中设置：

```dotenv
DAYFLOW_ALLOWED_ORIGINS=https://dayflow.example.com
VINEXT_TRUSTED_HOSTS=dayflow.example.com
```

将下面的转发配置放进已有 HTTPS 站点的 `location /` 中：

```nginx
proxy_pass http://127.0.0.1:3000;
proxy_set_header Host $http_host;
proxy_set_header X-Forwarded-Host $http_host;
proxy_set_header X-Forwarded-Proto $scheme;
```

`VINEXT_TRUSTED_HOSTS` 不带协议；如果使用非默认端口，需要带上端口。Node.js 保持监听本机，通过 `npm start` 启动。

若 `/api/data` 返回 403，先检查访问地址是否在白名单中。HTTPS 代理还需要正确传递域名和协议，否则保存任务时也会被同源校验拦截。更新代码后记得重新构建并重启。

## 数据和备份

默认数据库文件：

```text
.dayflow-data/dayflow.sqlite
```

任务、清单和设置都在这个文件里。数据保存在运行服务的机器上，不是浏览器里。可以用 `DAYFLOW_DB_PATH` 更改位置，相对路径从项目根目录计算；数据库所在目录需要可写。

平时可以在「设置与数据」中导出 JSON 备份。导入时会合并新任务和清单，同 ID 的已有任务会保留，不会覆盖成备份里的版本。备份文件大小不能超过 5 MB。

如果直接复制数据库文件，请先停止服务；恢复时也一样。写入过程中可能短暂出现 `-journal` 文件，事务结束后通常只保留主数据库文件。`.dayflow-data/` 不会提交到 Git，迁移机器或清理项目时记得单独备份。

多个页面同时修改同一份数据时，应用会检查版本冲突，避免覆盖刚保存的修改。

### 旧版 D1 数据迁移

旧版数据位于 `.dayflow-data/v3/d1/`。先停止旧服务，找到其中那份文件名为一长串字符的 `.sqlite` 文件，不要选 `metadata.sqlite`。在首次打开新版页面前执行：

```bash
npm run db:migrate -- ".dayflow-data/v3/d1/miniflare-D1DatabaseObject/<旧数据库文件名>.sqlite"
```

脚本只读旧库，保留原来的数据和版本号。目标数据库已有数据时会拒绝覆盖。也可以在旧版导出 JSON，再到新版导入。

## 使用说明

- 点击「新建任务」或使用快速输入框添加任务，点击任务打开编辑面板。
- 删除清单后，其中的任务会移到「收集箱」。
- 搜索会匹配任务名称、备注和标签。
- 专注计时结束后会累计完成次数；刷新或关闭页面会重置当前计时器。

| 快捷键 | 操作 |
| --- | --- |
| `N` | 新建任务，输入框内不触发 |
| `Ctrl+K` / `⌘+K` | 聚焦搜索框 |

## 开发

使用 React、TypeScript、Vinext、Vite、Tailwind CSS、Base UI 和 Node.js 内置 SQLite。

```bash
npm test
npx tsc --noEmit --incremental false
npm run lint
```

`npm run format` 会格式化代码并修改文件。

```text
app/                  页面、样式和数据接口
components/dayflow/   任务、日历、设置和专注面板
components/ui/        通用 UI 组件
hooks/                React Hooks
lib/tasks.ts          数据模型、校验和备份合并
lib/database.mjs      SQLite 连接与初始化
migrations/           数据表初始化 SQL
scripts/              旧版数据库迁移脚本
tests/                测试
docs/screenshots/     README 截图
```

遇到问题或有改进建议，可以提 [Issue](https://github.com/why-qw1ko/taskManage/issues)，也欢迎提交 PR。

## 许可证

我按 [MIT 许可证](LICENSE)开放这个项目。你可以自由使用、修改、分发、商用或用于闭源项目，保留原版权声明和许可证文本即可，不要求公开修改后的源码。

软件按原样提供，不作担保。第三方依赖仍遵循各自的许可证。
