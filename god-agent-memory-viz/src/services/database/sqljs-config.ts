import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

let SQL: SqlJsStatic | null = null;

// TODO: Bundle SQL.js WASM locally instead of fetching from CDN
// This would improve reliability and offline support.
// To implement:
// 1. Install sql.js as a dependency (npm install sql.js)
// 2. Copy WASM file to public directory during build
// 3. Update locateFile to point to local asset: `/sql-wasm.wasm`
// See: https://github.com/sql-js/sql.js#usage
export async function initializeSQL(): Promise<SqlJsStatic> {
  if (SQL) return SQL;

  SQL = await initSqlJs({
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
  });

  return SQL;
}

export function createDatabase(data?: ArrayLike<number>): Database {
  if (!SQL) {
    throw new Error('SQL.js not initialized. Call initializeSQL() first.');
  }
  return new SQL.Database(data);
}

export function getSQL(): SqlJsStatic | null {
  return SQL;
}
