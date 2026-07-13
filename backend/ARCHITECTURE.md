# 设备维护排班系统后端架构文档

## 1. 项目定位

本后端为设备维护排班系统提供业务 API、Oracle 数据持久化、排班任务生成、排班结果查询、Excel 人员导入和本地开发数据库环境。

当前项目从原来的纯前端 mock/localStorage 原型，升级为：

```txt
React 前端
  -> NestJS 后端 API
  -> Oracle 数据库
  -> 排班规则服务
```

第一阶段目标是完成本地可运行、可联调、可落库的业务闭环。

## 2. 技术栈

```txt
运行环境：Node.js
后端框架：NestJS
开发语言：TypeScript
数据库：Oracle Free Docker
数据库驱动：oracledb
Excel 解析：xlsx
本地容器：Docker Compose
```

后端没有使用复杂 ORM 实体层，当前直接基于 `oracledb` 封装数据库访问。这样可以更直接地控制 Oracle SQL、事务和导入逻辑。

## 3. 目录结构

```txt
backend
├─ docker-compose.yml
├─ .env.local
├─ package.json
├─ tsconfig.json
├─ nest-cli.json
├─ imports
│  └─ personnel-role-skill.xlsx
├─ scripts
│  ├─ db-common.js
│  ├─ db-migrate.js
│  ├─ db-seed.js
│  ├─ db-verify.js
│  └─ import-team-members.js
└─ src
   ├─ main.ts
   ├─ app.module.ts
   ├─ types
   │  └─ oracledb.d.ts
   └─ modules
      ├─ health
      ├─ database
      ├─ team-member
      ├─ shift-type
      ├─ attendance
      ├─ team-schedule-record
      ├─ schedule-job
      └─ schedule-result
```

## 4. 模块说明

### 4.1 health

提供后端健康检查。

```txt
GET /api/health
```

用于确认 NestJS 服务是否正常启动。

### 4.2 database

封装 Oracle 连接池和基础数据库操作。

主要能力：

```txt
query       查询
execute     单语句执行并提交
transaction 事务执行
db-check    数据库连通性检查
```

连通性接口：

```txt
GET /api/db-check
```

内部执行：

```sql
SELECT 1 AS OK FROM DUAL
```

### 4.3 team-member

维护班组人员和人员技能。

接口：

```txt
GET    /api/team-members
POST   /api/team-members
PUT    /api/team-members/:id
DELETE /api/team-members/:id
```

数据表：

```txt
TEAM_MEMBER
TEAM_MEMBER_SKILL
```

### 4.4 shift-type

维护班次定义。

接口：

```txt
GET    /api/shift-types
POST   /api/shift-types
PUT    /api/shift-types/:id
DELETE /api/shift-types/:id
```

数据表：

```txt
SHIFT_TYPE
```

### 4.5 attendance

维护人员出勤状态。

接口：

```txt
GET    /api/attendance-records
POST   /api/attendance-records
PUT    /api/attendance-records/:id
DELETE /api/attendance-records/:id
```

数据表：

```txt
ATTENDANCE_RECORD
```

### 4.6 team-schedule-record

查询班组当前轮换状态。

接口：

```txt
GET /api/team-schedule-records
```

数据表：

```txt
TEAM_SCHEDULE_RECORD
```

### 4.7 schedule-job

创建排班任务、查询任务、查询日志、删除任务。

接口：

```txt
POST   /api/schedule-jobs
GET    /api/schedule-jobs/:id
GET    /api/schedule-jobs/:id/logs
DELETE /api/schedule-jobs/:id
```

数据表：

```txt
SCHEDULE_JOB
SCHEDULE_SPECIAL_REQUEST
SCHEDULE_JOB_LOG
SCHEDULE_RESULT
```

当前排班逻辑为第一版确定性规则：

```txt
1. 根据日期范围生成每日排班。
2. A1/A2/A3 按早班、晚班轮换。
3. B 组工作日排长白班。
4. 根据出勤记录过滤不可用人员。
5. 支持特殊人员排班要求。
6. 生成结果后写入 SCHEDULE_RESULT。
7. 排班过程写入 SCHEDULE_JOB_LOG。
```

### 4.8 schedule-result

查询和导出排班结果。

接口：

```txt
GET /api/schedule-results
GET /api/schedule-results/export
```

支持筛选参数：

```txt
jobId
team
personName
startDate
endDate
```

当前导出格式为 CSV。

## 5. 数据库设计

### 5.1 基础资料表

```txt
TEAM_MEMBER
- ID
- NAME
- TEAM
- SHIFT_TYPE
- ROLE
- STATUS
- CREATED_AT
- UPDATED_AT

TEAM_MEMBER_SKILL
- ID
- MEMBER_ID
- SKILL_NAME

SHIFT_TYPE
- ID
- SHIFT_CATEGORY
- SCHEDULE_RULE
- SHIFT_NAME
- START_TIME
- END_TIME
- CREATED_AT
- UPDATED_AT

ATTENDANCE_RECORD
- ID
- MEMBER_ID
- PERSON_NAME
- TEAM
- START_DATE
- END_DATE
- STATUS
- UPDATED_AT

TEAM_SCHEDULE_RECORD
- ID
- TEAM
- TYPE
- CURRENT_SHIFT
- CURRENT_SHIFT_DATE
- NEXT_SHIFT
- NEXT_SHIFT_DATE
- UPDATED_AT
```

### 5.2 排班业务表

```txt
SCHEDULE_JOB
- ID
- WEEKEND_MACHINE_COUNT
- START_DATE
- END_DATE
- STATUS
- ERROR_MESSAGE
- CREATED_AT
- FINISHED_AT

SCHEDULE_SPECIAL_REQUEST
- ID
- JOB_ID
- PERSON_NAME
- REQUEST_DATE
- SHIFT_NAME

SCHEDULE_JOB_LOG
- ID
- JOB_ID
- LEVEL_NAME
- MESSAGE
- CREATED_AT

SCHEDULE_RESULT
- ID
- JOB_ID
- WORK_DATE
- SHIFT_NAME
- TEAM
- MEMBER_ID
- PERSON_NAME
- ROLE_NAME
- SKILLS_TEXT
- STATUS
- CREATED_AT
```

## 6. Excel 人员导入

当前已支持通过脚本导入人员角色技能 Excel。

Excel 文件位置：

```txt
backend/imports/personnel-role-skill.xlsx
```

导入命令：

```powershell
cd backend
npm run import:team-members
```

Excel 表头要求：

```txt
姓名
班组
班次类型
角色
技能
```

导入规则：

```txt
1. 按姓名判断人员是否已存在。
2. 姓名不存在则新增 TEAM_MEMBER。
3. 姓名存在则更新 TEAM_MEMBER。
4. 每次导入会重建该人员的 TEAM_MEMBER_SKILL。
5. 角色包含“班长”时会归一化为“组长”。
6. 班次类型“早班/晚班”会归一化为“早晚班”。
```

这套导入目前是后端脚本导入，还不是前端上传接口。后续可以扩展为：

```txt
POST /api/team-members/import-excel
Content-Type: multipart/form-data
```

## 7. 本地运行

### 7.1 启动 Oracle

```powershell
cd backend
docker compose up -d oracle
```

验证：

```powershell
docker ps
npm run db:verify
```

### 7.2 启动后端

```powershell
cd backend
npm run build
node dist/main.js
```

后端地址：

```txt
http://localhost:3000/api
```

健康检查：

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/db-check
```

### 7.3 启动前端

项目根目录执行：

```powershell
npx.cmd vite --port 8001 --host 0.0.0.0
```

前端地址：

```txt
http://localhost:8001
```

## 8. 环境变量

本地配置文件：

```txt
backend/.env.local
```

内容：

```env
PORT=3000
DB_HOST=localhost
DB_PORT=1521
DB_SERVICE=FREEPDB1
DB_USER=maintenance
DB_PASSWORD=maintenance_pwd
```

后续接真实 Oracle 时，只需要替换：

```txt
DB_HOST
DB_PORT
DB_SERVICE
DB_USER
DB_PASSWORD
```

业务代码不需要修改。

## 9. 后端脚本

```txt
npm run db:migrate
```

创建缺失的数据表。

```txt
npm run db:seed
```

插入初始 demo 数据。

```txt
npm run db:verify
```

检查核心表数据量。

```txt
npm run db:setup
```

执行建表和 seed。

```txt
npm run import:team-members
```

从 Excel 导入人员角色技能。

## 10. 当前已完成能力

```txt
1. 本地 Oracle Docker 数据库
2. NestJS 后端骨架
3. Oracle 数据库连接池
4. 基础资料 CRUD
5. 出勤记录 CRUD
6. 班组轮换记录查询
7. 排班任务创建
8. 排班日志记录
9. 排班结果查询
10. 排班结果 CSV 导出
11. Excel 人员技能导入脚本
12. 前端主要页面接入后端 API
```

## 11. 后续建议

优先级从高到低：

```txt
1. 增加前端 Excel 上传按钮和后端上传接口。
2. 完善排班算法，覆盖完整的上4休2、借调、技能人数规则。
3. 增加登录、角色、权限和操作审计。
4. 增加 Excel xlsx 导出。
5. 增加排班任务异步队列和实时日志。
6. 增加接口 DTO 校验和统一错误响应。
7. 增加自动化测试。
8. 增加生产环境部署配置。
```

## 12. 架构原则

当前后端遵循以下原则：

```txt
1. 前端只负责展示和提交参数。
2. 业务数据统一由后端写入 Oracle。
3. 排班结果必须落库，便于追溯。
4. Excel 导入不直接覆盖所有业务表，只更新人员和技能。
5. 本地 Oracle 与真实 Oracle 通过环境变量切换。
6. 第一阶段保持模块化单体，不拆微服务。
```
