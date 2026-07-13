import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';

type DbCheckRow = {
  OK: number;
};

type BindParams = unknown[] | Record<string, unknown>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: oracledb.Pool | null = null;

  constructor(private readonly configService: ConfigService) {}

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

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.close(10);
      this.pool = null;
    }
  }

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

  private buildConnectString() {
    const host = this.configService.getOrThrow<string>('DB_HOST');
    const port = this.configService.get<string>('DB_PORT', '1521');
    const service = this.configService.getOrThrow<string>('DB_SERVICE');

    return `${host}:${port}/${service}`;
  }
}
