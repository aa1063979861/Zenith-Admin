# ZenithAdmin

众恒科技管理系统，面向客户、订单、服务项、财务、提成、档案和经营看板的一体化后台。

## 项目结构

```text
.
├─ apps/server/          # NestJS + TypeORM + MySQL 后端
├─ build/                # Vite/UnoCSS 构建辅助源码，不是构建产物
├─ public/               # 前端静态资源
├─ scripts/              # 本地开发脚本
├─ src/                  # Vue 3 前端
├─ AGENTS.md             # 项目规则、业务约束和开发入口说明
├─ pnpm-workspace.yaml   # pnpm workspace 与 overrides
└─ package.json          # 前端脚本和依赖
```

运行产物和本地状态默认不进入版本管理：

- `dist/`
- `apps/server/dist/`
- `.runtime/`
- `node_modules/`
- `apps/*/.env`
- `apps/*/uploads/`

## 技术栈

- 前端：Vite、Vue 3、Pinia、Vue Router、Naive UI、UnoCSS、ECharts
- 后端：NestJS、TypeORM、MySQL
- Excel 导入：后端使用 xlsx 解析 `.xls` / `.xlsx`

## 本地启动

推荐使用统一脚本：

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File "./scripts/start-dev.ps1"
```

脚本会检查并启动本机 `MySQL84`，构建后端，启动后端 `8085` 和前端 `3200`。运行日志写入 `.runtime/`。

也可以分别执行：

```powershell
pnpm install
pnpm --filter "@zenith-admin/server" start:dev
pnpm dev
```

## 生产更新与部署

生产站点为 `https://zhiqiangl.cn/`，服务器公网 IP 为 `101.126.143.247`。日常更新从本机执行固定脚本：

```powershell
powershell -ExecutionPolicy Bypass -File "C:/Users/Administrator/Desktop/demo/demo1/Zenith-Admin/scripts/deploy-prod.ps1"
```

脚本会依次完成：

- 后端构建：`pnpm --filter "@zenith-admin/server" run build`
- 前端构建：`pnpm build`
- 打包上传到服务器 `/tmp/zhiqiangl-admin.tar.gz`
- 解压到 `/opt/zhiqiangl-admin/releases/<yyyyMMddHHmmss>`
- 复制线上 `apps/server/.env`
- 将上传目录链接到 `/opt/zhiqiangl-admin/uploads`
- 安装生产依赖并切换 `/opt/zhiqiangl-admin/current`
- 重启 systemd 服务 `zhiqiangl-admin`

线上部署约定：

- SSH key：`C:/Users/Administrator/.ssh/zhiqiangl_ed25519`
- 应用目录：`/opt/zhiqiangl-admin`
- 当前版本：`/opt/zhiqiangl-admin/current`
- 版本目录：`/opt/zhiqiangl-admin/releases/`
- 后端服务：`zhiqiangl-admin`
- 后端端口：`8085`
- Nginx 对外提供 `80/443`
- 本项目生产 MySQL 只使用服务器本机 `127.0.0.1:3307` 和库 `zhiqiangl_admin`
- 不要动服务器 `3306` 端口和 `zenith_admin` 库，它们属于另一个项目

部署后快速检查：

```powershell
ssh -i "C:/Users/Administrator/.ssh/zhiqiangl_ed25519" root@101.126.143.247 "systemctl is-active zhiqiangl-admin && readlink -f /opt/zhiqiangl-admin/current"
curl.exe -k -I "https://zhiqiangl.cn/"
```

回滚到上一个版本时，在服务器上把 `current` 指回旧 release 并重启服务：

```bash
ln -sfn /opt/zhiqiangl-admin/releases/<旧版本号> /opt/zhiqiangl-admin/current
systemctl restart zhiqiangl-admin
systemctl is-active zhiqiangl-admin
```

常见排障：

- 服务器控制台出现大量 `UFW BLOCK` 高位端口日志，通常是公网扫描，不是项目端口异常。
- 控制台刷屏时可临时执行 `dmesg -n 1`，再检查 `systemctl status ssh nginx zhiqiangl-admin --no-pager`。
- 如果部署在“上传后、切换前”中断，先确认 `/tmp/zhiqiangl-admin.tar.gz` 是否存在，再只执行远端解压、切换、重启步骤，避免重复构建。

## 常用检查

```powershell
pnpm audit --registry "https://registry.npmjs.org"
pnpm peers check
pnpm --filter "@zenith-admin/server" exec tsc -p "tsconfig.json" --noEmit
pnpm --filter "@zenith-admin/server" run build
pnpm build
```

后端构建会先执行 `apps/server/scripts/check-schema-comments.cjs`，校验 TypeORM 表和字段注释。

## 开发约束

- 先读 `AGENTS.md`，再改业务代码。
- 正式业务规则必须落在后端 API 或数据库约束中，不能只写在浏览器端。
- 前端不得保留 mock、样例数据或本地原型兜底；业务页面必须接真实后端 API。
- 后端本地 `apps/server/.env` 不要提交；模板使用 `apps/server/.env.example`。前端 `.env*` 仅保留公开 Vite 默认配置。
- 不执行 `git commit`、`git push`、`git reset --hard`，除非用户明确要求。
