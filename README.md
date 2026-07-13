# 设备维护排班系统

这是一个用于设备维护人员排班管理的本地可运行项目。当前版本已经从纯前端原型升级为：

```txt
React 前端
  -> NestJS 后端 API
  -> Oracle Docker 数据库
```

系统支持基础资料维护、Excel 导入、规则排班、结果查询、异常人工修正、员工查询和 CSV 导出。

## 当前完成情况

已完成：

- 前端页面：排班配置、排班结果、班组管理、人员信息、班组排班记录
- 后端服务：NestJS + TypeScript
- 本地数据库：Oracle Free Docker
- 基础资料 CRUD：人员、班次、出勤
- 班组轮换记录查询
- 排班任务创建、日志、结果落库
- 排班结果查询与 CSV 导出
- 排班结果按日期最新任务展示
- 排班异常字段标红和人工修正
- 员工查询智能体
- 班组人员 Excel 导入
- 确定性排班规则引擎
- 排班算法基础防错和入库前校验

尚未完成：

- 登录和权限
- AI 排班引擎后端接入
- xlsx 格式导出
- 自动化测试
- 生产部署脚本

## 技术栈

```txt
前端：React 19、TypeScript、Vite、Tailwind CSS、Radix UI、lucide-react
后端：Node.js、NestJS、TypeScript、oracledb、xlsx
数据库：Oracle Free Docker、Docker Compose
```

## 目录结构

```txt
.
├── src                         # 前端源码
│   ├── app.tsx                  # 路由配置
│   ├── index.tsx                # 前端入口
│   ├── lib
│   │   └── api.ts               # 前端 API 封装
│   ├── components               # 公共布局和 UI 组件
│   └── pages                    # 业务页面
├── backend                     # 后端源码
│   ├── docker-compose.yml       # Oracle 本地容器
│   ├── .env.local               # 后端本地环境变量
│   ├── ARCHITECTURE.md          # 后端架构文档
│   ├── imports
│   │   └── personnel-role-skill.xlsx
│   ├── scripts                  # 数据库脚本
│   └── src
│       └── modules              # NestJS 业务模块
├── public
├── shared
└── package.json
```

## 环境要求

需要安装：

```txt
Node.js
npm
Docker
Docker Compose
```

本文档使用 Linux/macOS shell 风格命令。Windows 用户可在 WSL、Git Bash 或 PowerShell 中按等价命令执行。

## 首次启动

### 1. 启动 Oracle

```bash
cd backend
docker compose up -d oracle
```

### 2. 创建表并初始化数据

```bash
npm run db:migrate
npm run db:seed
```

### 3. 启动后端

```bash
cd backend
npm run build
node dist/main.js
```

后端地址：

```txt
http://localhost:3000/api
```

检查接口：

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/db-check
```

### 4. 启动前端

新开一个终端，在项目根目录执行：

```bash
npm run dev
```

前端地址：

```txt
http://localhost:8001
```

## 日常运行

一般需要三个终端：

```bash
# 终端 1：数据库
cd backend
docker compose up -d oracle
```

```bash
# 终端 2：后端
cd backend
npm run start:prod
```

```bash
# 终端 3：前端
npm run dev
```

局域网访问：

```txt
http://你的电脑IP:8001
```

## 关闭服务

停止前后端 Node 进程：

```bash
pkill -f "node dist/main.js" || true
pkill -f "vite --port 8001" || true
```

停止 Oracle：

```bash
cd backend
docker compose down
```

`docker compose down` 不会删除数据库 volume，数据会保留。

## 数据库连接

本地 Oracle 连接信息：

```txt
Host: localhost
Port: 1521
Service Name: FREEPDB1
Username: maintenance
Password: maintenance_pwd
```

JDBC URL：

```txt
jdbc:oracle:thin:@localhost:1521/FREEPDB1
```

后端配置文件：`backend/.env.local`

```env
PORT=3000
DB_HOST=localhost
DB_PORT=1521
DB_SERVICE=FREEPDB1
DB_USER=maintenance
DB_PASSWORD=maintenance_pwd
```

## 数据表

基础资料表：

```txt
TEAM_MEMBER
TEAM_MEMBER_SKILL
SHIFT_TYPE
ATTENDANCE_RECORD
TEAM_SCHEDULE_RECORD
```

排班业务表：

```txt
SCHEDULE_JOB
SCHEDULE_SPECIAL_REQUEST
SCHEDULE_JOB_LOG
SCHEDULE_RESULT
```

## 后端 API

健康检查：

```txt
GET /api/health
GET /api/db-check
```

班组人员：

```txt
GET    /api/team-members
POST   /api/team-members
PUT    /api/team-members/:id
DELETE /api/team-members/:id
POST   /api/team-members/import-excel
```

班次：

```txt
GET    /api/shift-types
POST   /api/shift-types
PUT    /api/shift-types/:id
DELETE /api/shift-types/:id
```

出勤：

```txt
GET    /api/attendance-records
POST   /api/attendance-records
PUT    /api/attendance-records/:id
DELETE /api/attendance-records/:id
```

班组轮换：

```txt
GET /api/team-schedule-records
```

排班任务：

```txt
POST   /api/schedule-jobs
GET    /api/schedule-jobs/:id
GET    /api/schedule-jobs/:id/logs
DELETE /api/schedule-jobs/:id
```

排班结果：

```txt
GET /api/schedule-results
GET /api/schedule-results/export
PUT /api/schedule-results/:id
PUT /api/schedule-results/:id/acknowledge-exception
```

员工查询智能体：

```txt
POST /api/employee-agent/query
```

## 排班规则能力

当前后端使用确定性规则引擎生成排班，不依赖外部 AI。

核心规则：

```txt
A1/A2/A3 按 早班、早班、晚班、晚班、休息、休息 轮换
工作日早班不少于 5 人，晚班不少于 6 人
早晚班必须满足组长、电工、注塑维修要求
周末按开机数量换算人数
休假/请假人员不能排班
同一员工同一天不能多班
缺人或缺技能时，只能从当天休息班组借调
严重结构异常会使任务 FAILED，且不会推进班组轮换记录
```

结果查询口径：

```txt
默认按每个日期最新一次排班任务展示
支持按人员、日期范围、班组、校验结果筛选
CSV 导出与当前筛选口径一致
员工查询智能体也使用相同的最新任务口径
```

## 排班异常人工修正

前端入口：

```txt
排班结果 -> 操作 -> 编辑
```

能力：

```txt
可修改班次、班组、人员、角色、技能、借调信息、校验结果和异常原因
保存为“通过”或“已确认”前会校验同日人员冲突、休假、借调来源和班组冲突
异常行会整体标红，并按异常原因标红具体字段
```

## 员工查询智能体

前端入口：

```txt
员工查询
```

示例：

```txt
查询张工个人信息
查询张工未来7天排班
查询张工借调记录
查询张工异常排班
查询张工休假记录
```

说明：

```txt
当前版本是规则解析式智能体，不需要大模型 API Key
支持个人信息、排班、借调、异常、出勤查询
默认日期为今天到 7 天后
页面会记住上一次查询条件和聊天记录
```

## Excel 导入

前端入口：

```txt
班组管理 -> 导入 Excel
```

上传接口：

```txt
POST /api/team-members/import-excel
Content-Type: multipart/form-data
字段名：file
```

Excel 表头：

```txt
姓名
班组
班次类型
角色
技能
```

导入规则：

```txt
姓名不存在：新增人员
姓名已存在：更新人员
每次导入都会重建该人员技能
角色包含“班长”：归一化为“组长”
班次类型“早班/晚班”：归一化为“早晚班”
```

脚本导入：

```bash
cd backend
npm run import:team-members
```

默认读取：

```txt
backend/imports/personnel-role-skill.xlsx
```

接口测试：

```bash
curl -X POST \
  -F "file=@backend/imports/personnel-role-skill.xlsx" \
  http://localhost:3000/api/team-members/import-excel
```

## 常用验证命令

后端：

```bash
cd backend
npm run typecheck
npm run build
npm run db:verify
```

前端：

```bash
npm run typecheck
npx vite build --outDir dist/client-test --emptyOutDir
```

清理临时构建目录：

```bash
rm -rf dist/client-test
```

## 常见问题

### 1. 后端启动报 EADDRINUSE 3000

3000 端口已被旧后端进程占用：

```bash
lsof -i :3000
kill -9 <PID>
```

### 2. 前端页面无法加载数据

先确认后端是否正常：

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/db-check
```

默认后端地址在 `src/lib/api.ts` 中配置。

### 3. Oracle 容器不是 healthy

查看日志：

```bash
cd backend
docker logs --tail 120 maintenance-oracle
```

如果 Docker 内存不足，建议给 Docker 分配 4GB 以上内存。

更多后端细节见：

```txt
backend/ARCHITECTURE.md
```
