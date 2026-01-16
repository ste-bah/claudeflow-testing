import { describe, it, expect } from 'vitest';

describe('TASK-004 Smoke Test', () => {
  it('vitest is configured correctly', () => {
    expect(true).toBe(true);
  });

  it('can import cytoscape', async () => {
    const cytoscape = await import('cytoscape');
    expect(cytoscape.default).toBeDefined();
  });

  it('can import zustand', async () => {
    const zustand = await import('zustand');
    expect(zustand.create).toBeDefined();
  });

  it('can import date-fns', async () => {
    const { format } = await import('date-fns');
    expect(format).toBeDefined();
  });

  it('can import sql.js types', async () => {
    // Type-only test - verifies declarations work
    const initSqlJs = (await import('sql.js')).default;
    expect(initSqlJs).toBeDefined();
  });
});
