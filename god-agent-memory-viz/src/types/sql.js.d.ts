declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  export interface Database {
    run(sql: string, params?: BindParams): Database;
    exec(sql: string, params?: BindParams): QueryExecResult[];
    each(
      sql: string,
      params: BindParams,
      callback: (row: ParamsObject) => void,
      done: () => void
    ): Database;
    each(sql: string, callback: (row: ParamsObject) => void, done: () => void): Database;
    prepare(sql: string, params?: BindParams): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
    create_function(name: string, func: (...args: any[]) => any): Database;
    create_aggregate(
      name: string,
      functions: {
        init?: () => any;
        step: (state: any, ...args: any[]) => any;
        finalize: (state: any) => any;
      }
    ): Database;
  }

  export interface Statement {
    bind(params?: BindParams): boolean;
    step(): boolean;
    getColumnNames(): string[];
    getAsObject(params?: BindParams): ParamsObject;
    get(params?: BindParams): SqlValue[];
    run(params?: BindParams): void;
    reset(): void;
    freemem(): void;
    free(): boolean;
  }

  export interface QueryExecResult {
    columns: string[];
    values: SqlValue[][];
  }

  export type BindParams = SqlValue[] | ParamsObject | null;
  export type ParamsObject = Record<string, SqlValue>;
  export type SqlValue = number | string | Uint8Array | null;

  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
    wasmBinary?: ArrayBuffer;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
