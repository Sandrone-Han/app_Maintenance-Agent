import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';

type DbCheckRow = {
  OK: number;
};

type BindParams = unknown[] | Record<string, unknown>;

@Injectable()
// 数据库服务：封装 Oracle 连接池、查询、执行和事务提交/回滚。
export class DatabaseService implements OnModuleDestroy {
  private pool: oracledb.Pool | null = null;

  constructor(private readonly configService: ConfigService) {}

  // 健康检查使用的轻量查询，验证数据库连接是否可用。
  async checkConnection() {
    const pool = await this.getPool();
    const connection = await pool.getConnection();

    try {
      const result = await connection.execute<DbCheckRow>(
        'SELECT 1 AS OK FROM DUAL',
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );

      return {
        status: 'ok',
        database: 'oracle',
        result: result.rows?.[0] ?? null,
        timestamp: new Date().toISOString(),
      };
    } finally {
      await connection.close();
    }
  }

  // 只读查询封装，默认返回对象格式行数据。
  async query<T>(
    sql: string,
    bindParams: BindParams = [],
  ): Promise<T[]> {
    const pool = await this.getPool();
    const connection = await pool.getConnection();

    try {
      const result = await connection.execute<T>(
        sql,
        bindParams,
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );

      return result.rows ?? [];
    } finally {
      await connection.close();
    }
  }

  // 单条写入/更新/删除封装，自动提交，失败时回滚。
  async execute(
    sql: string,
    bindParams: BindParams = [],
  ): Promise<void> {
    const pool = await this.getPool();
    const connection = await pool.getConnection();

    try {
      await connection.execute(sql, bindParams);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.close();
    }
  }

  // 多步数据库操作事务封装，调用方在同一连接中完成读写。
  async transaction<T>(
    callback: (connection: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    const pool = await this.getPool();
    const connection = await pool.getConnection();

    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.close();
    }
  }

  // 应用关闭时释放 Oracle 连接池。
  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.close(10);
      this.pool = null;
    }
  }

  // 懒加载连接池，首次数据库访问时按环境变量创建。
  private async getPool() {
    if (!this.pool) {
      this.pool = await oracledb.createPool({
        user: this.configService.getOrThrow<string>('DB_USER'),
        password: this.configService.getOrThrow<string>('DB_PASSWORD'),
        connectString: this.buildConnectString(),
        poolMin: 1,
        poolMax: 4,
        poolIncrement: 1,
      });
    }

    return this.pool;
  }

  // 拼接 Oracle connectString，形如 host:port/service。
  private buildConnectString() {
    const host = this.configService.getOrThrow<string>('DB_HOST');
    const port = this.configService.get<string>('DB_PORT', '1521');
    const service = this.configService.getOrThrow<string>('DB_SERVICE');

    return `${host}:${port}/${service}`;
  }
}
