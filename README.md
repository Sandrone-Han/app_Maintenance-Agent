# 设备维护排班系统

设备维护排班管理系统，当前版本为：

```txt
React + Vite 前端
NestJS 后端 API
Oracle 数据库
```

系统支持排班配置、排班结果、泳道图、请假替班、换班、数据统计、员工查询、班组管理、休假信息管理和 CSV 导出。

## 核心功能

- 排班配置：按日期范围、周末开机数量和特殊要求生成排班。
- 排班结果：筛选、编辑、确认异常、CSV 导出。
- 班组图：按人员/班组查看排班，并处理请假替班和换班。
- 临时调整：请假替班只作为覆盖层，不修改原始排班。
- 换班：两条已有班次互换，不产生欠班。
- 数据统计：按周或自选时间段统计工时、班组、异常、借调、调整和换班。
- 基础资料：维护班组人员、班次、休假信息，支持人员 Excel 导入。
- 员工查询：查询人员信息、排班、借调、异常和休假记录。

当前排班使用后端确定性规则引擎，不依赖外部 AI 服务。

## 目录结构

```txt
.
├── src
│   ├── app.tsx                     # 前端路由
│   ├── index.tsx                   # 前端入口
│   ├── components                  # 布局和通用组件
│   ├── config
│   │   └── navigation.ts           # 顶部导航和侧边栏导航配置
│   ├── data                        # 前端类型和空 mock 数据
│   ├── lib
│   │   └── api.ts                  # API 请求封装
│   └── pages                       # 业务页面
│       ├── ScheduleConfigPage      # 排班配置
│       ├── ScheduleResultPage      # 排班结果、泳道图、调整弹窗
│       ├── TeamManagePage          # 班组和班次管理
│       ├── PersonnelPage           # 休假信息
│       ├── TeamScheduleRecordPage  # 排班记录
│       ├── DataStatisticsPage      # 数据统计
│       └── EmployeeAgentPage       # 员工查询
├── backend
│   ├── docker-compose.yml          # 本地 Oracle
│   ├── scripts                     # 数据库迁移、初始化、校验、导入脚本
│   ├── imports                     # Excel 导入示例文件
│   └── src
│       ├── main.ts                 # 后端入口
│       ├── app.module.ts           # NestJS 模块入口
│       └── modules
│           ├── schedule-job        # 排班任务和排班引擎
│           ├── schedule-result     # 排班结果查询、编辑、导出
│           ├── schedule-adjustment # 请假替班
│           ├── schedule-swap       # 换班
│           ├── team-member         # 班组人员
│           ├── shift-type          # 班次配置
│           ├── attendance          # 休假/出勤记录
│           ├── team-schedule-record# 班组轮换记录
│           ├── employee-agent      # 员工查询
│           └── database            # Oracle 连接池
├── public                          # 静态资源
├── shared                          # 平台共享资源
├── scripts                         # 前端开发/构建脚本
├── package.json                    # 前端脚本和依赖
└── README.md
```

## 本地启动

### 1. 启动 Oracle

```bash
cd backend
docker compose up -d oracle
```

### 2. 创建表并初始化数据

```bash
cd backend
npm run db:migrate
npm run db:seed
```

### 3. 启动后端

```bash
cd backend
npm run build
npm run start:prod
```

后端地址：

```txt
http://localhost:3000/api
```

### 4. 启动前端

```bash
npm run dev
```

前端地址以终端输出为准。

## 数据库迁移

上线前需要在目标数据库执行一次：

```bash
cd backend
npm run db:migrate
```

迁移包含基础表、排班结果表、请假替班表、换班表，以及请假替班/换班的生效唯一索引。

如果已有重复的生效请假替班或换班记录，唯一索引创建会失败，需要先清理重复数据。

## 主要 API

```txt
GET    /api/health
GET    /api/db-check

GET    /api/team-members
POST   /api/team-members
PUT    /api/team-members/:id
DELETE /api/team-members/:id
POST   /api/team-members/import-excel

GET    /api/shift-types
POST   /api/shift-types
PUT    /api/shift-types/:id
DELETE /api/shift-types/:id

GET    /api/attendance-records
POST   /api/attendance-records
PUT    /api/attendance-records/:id
DELETE /api/attendance-records/:id

POST   /api/schedule-jobs
GET    /api/schedule-jobs/:id
GET    /api/schedule-jobs/:id/logs
DELETE /api/schedule-jobs/:id

GET    /api/schedule-results
GET    /api/schedule-results/export
PUT    /api/schedule-results/:id
PUT    /api/schedule-results/:id/acknowledge-exception

GET    /api/schedule-adjustments/recommendations
POST   /api/schedule-adjustments
GET    /api/schedule-adjustments
PUT    /api/schedule-adjustments/:id/cancel

GET    /api/schedule-swaps/recommendations
POST   /api/schedule-swaps
GET    /api/schedule-swaps
PUT    /api/schedule-swaps/:id/cancel

POST   /api/employee-agent/query
```

## 验证命令

前端：

```bash
npm run typecheck
npm run lint:eslint
npx vite build
```

后端：

```bash
cd backend
npm run typecheck
npm run lint
npm run build
npm run db:verify
```

## 构建说明

前端正式构建脚本：

```bash
npm run build
```

该命令调用 `bash scripts/build.sh`。如果在 Windows 本机缺少 bash/WSL，可能无法运行；Linux/CI 环境通常正常。本地只验证前端能否打包时可使用：

```bash
npx vite build
```

后端生产启动：

```bash
cd backend
npm run build
npm run start:prod
```

## 上线注意

- 确认前端 `VITE_API_BASE_URL` 指向正式后端。
- 确认后端 `DB_HOST`、`DB_PORT`、`DB_SERVICE`、`DB_USER`、`DB_PASSWORD` 指向正式数据库。
- 先在目标数据库执行 `npm run db:migrate`。
- 如迁移创建唯一索引失败，先清理重复的生效请假替班/换班记录。
- 当前后端 CORS 需要按正式前端域名收紧。
