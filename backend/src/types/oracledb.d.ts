declare module 'oracledb' {
  export const OUT_FORMAT_OBJECT: number;

  export interface ExecuteOptions {
    outFormat?: number;
  }

  export interface Result<T> {
    rows?: T[];
  }

  export interface Connection {
    execute<T>(
      sql: string,
      bindParams?: unknown[] | Record<string, unknown>,
      options?: ExecuteOptions,
    ): Promise<Result<T>>;
    close(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
  }

  export interface Pool {
    getConnection(): Promise<Connection>;
    close(drainTime?: number): Promise<void>;
  }

  export interface PoolAttributes {
    user: string;
    password: string;
    connectString: string;
    poolMin?: number;
    poolMax?: number;
    poolIncrement?: number;
  }

  export function createPool(attributes: PoolAttributes): Promise<Pool>;
}
