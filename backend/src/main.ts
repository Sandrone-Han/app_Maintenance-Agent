import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

// NestJS 后端启动入口：创建应用、设置全局 API 前缀和跨域策略。
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 所有 HTTP 接口统一挂在 /api 下，便于前端通过 API_BASE_URL 调用。
  app.setGlobalPrefix('api');
  // 本地前后端分端口开发时允许跨域访问。
  app.enableCors();

  const configService = app.get(ConfigService);
  // PORT 可由环境变量覆盖，默认监听 3000。
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
}

void bootstrap();
