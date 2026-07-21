# 离线 Docker 部署说明

这套程序可以先在能联网的电脑上构建好 Docker 镜像，再把镜像包拷贝到受限电脑离线运行。

## 在能联网的电脑上打包

在项目根目录执行：

```powershell
docker pull gvenzl/oracle-free:latest
docker compose --env-file .env.production build
docker save -o maintenance-scheduler-images.tar maintenance-scheduler-frontend:offline maintenance-scheduler-backend:offline gvenzl/oracle-free:latest
```

把下面这些内容拷贝到受限电脑的同一个目录：

```txt
maintenance-scheduler-images.tar
docker-compose.yml
.env.production
backend/db/init/
```

`backend/db/init/` 是 Oracle 启动脚本挂载目录，可以为空，但目录需要存在。

## 受限电脑第一次运行

```powershell
docker load -i maintenance-scheduler-images.tar
docker compose --env-file .env.production up -d oracle
docker compose --env-file .env.production run --rm backend npm run db:setup
docker compose --env-file .env.production up -d
```

打开程序：

```txt
http://localhost:8080
```

后端健康检查：

```txt
http://localhost:8080/api/health
```

## 日常操作

启动：

```powershell
docker compose --env-file .env.production up -d
```

停止：

```powershell
docker compose down
```

查看状态：

```powershell
docker compose ps
```

查看日志：

```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f oracle
```

## 注意事项

- Oracle 数据保存在 Docker volume `oracle-data`。
- 不要删除 `oracle-data`，除非你明确要清空数据库。
- 在 Docker 内部，后端连接 Oracle 使用 `DB_HOST=oracle`，不能使用 `localhost`。
