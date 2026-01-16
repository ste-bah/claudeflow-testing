import type { Database, SqlJsStatic } from 'sql.js';

let SQL: SqlJsStatic | null = null;

// Declare global initSqlJs for CDN script loading
declare global {
  interface Window {
    initSqlJs?: (config: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

// sql.js WASM loading - uses CDN script injection for reliable browser compatibility
export async function initializeSQL(): Promise<SqlJsStatic> {
  if (SQL) return SQL;

  // Load sql.js from CDN via script tag - most reliable browser method
  if (!window.initSqlJs) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://sql.js.org/dist/sql-wasm.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load sql.js from CDN'));
      document.head.appendChild(script);
    });
  }

  if (!window.initSqlJs) {
    throw new Error('sql.js failed to initialize - initSqlJs not found on window');
  }

  SQL = await window.initSqlJs({
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
