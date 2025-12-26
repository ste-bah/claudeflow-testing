import { describe, it, expect, beforeEach } from 'vitest';
import { RollingWindow, WindowConfig, ContextEntry } from '@god-agent/core/ucm/index.js';

describe('RollingWindow', () => {
  let window: RollingWindow;
  let defaultConfig: WindowConfig;

  beforeEach(() => {
    defaultConfig = {
      maxSize: 5,
      evictionPolicy: 'fifo'
    };
    window = new RollingWindow(defaultConfig);
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultWindow = new RollingWindow();
      expect(defaultWindow).toBeDefined();
    });

    it('should accept custom config', () => {
      const customConfig: WindowConfig = {
        maxSize: 10,
        evictionPolicy: 'lru'
      };
      const customWindow = new RollingWindow(customConfig);

      expect(customWindow).toBeDefined();
    });
  });

  describe('add', () => {
    it('should add entries to window', () => {
      const entry: ContextEntry = {
        id: '1',
        content: 'Test content',
        timestamp: Date.now()
      };

      window.add(entry);

      const entries = window.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(entry);
    });

    it('should maintain insertion order', () => {
      const entries = [
        { id: '1', content: 'First', timestamp: Date.now() },
        { id: '2', content: 'Second', timestamp: Date.now() + 1 },
        { id: '3', content: 'Third', timestamp: Date.now() + 2 }
      ];

      entries.forEach(e => window.add(e));

      const stored = window.getAll();
      expect(stored.map(e => e.id)).toEqual(['1', '2', '3']);
    });

    it('should return added entry', () => {
      const entry: ContextEntry = {
        id: '1',
        content: 'Test',
        timestamp: Date.now()
      };

      const result = window.add(entry);

      expect(result).toEqual(entry);
    });
  });

  describe('FIFO eviction', () => {
    it('should evict oldest entry when window is full', () => {
      // Fill window to capacity
      for (let i = 0; i < 5; i++) {
        window.add({
          id: String(i),
          content: `Content ${i}`,
          timestamp: Date.now() + i
        });
      }

      // Add one more to trigger eviction
      window.add({
        id: '5',
        content: 'Content 5',
        timestamp: Date.now() + 5
      });

      const entries = window.getAll();
      expect(entries).toHaveLength(5);
      expect(entries[0].id).toBe('1'); // '0' was evicted
      expect(entries[4].id).toBe('5');
    });

    it('should evict multiple entries if needed', () => {
      window.add({ id: '1', content: 'A', timestamp: Date.now() });
      window.add({ id: '2', content: 'B', timestamp: Date.now() + 1 });

      // Resize to smaller capacity
      window.resize(1);

      const entries = window.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('2'); // Most recent kept
    });

    it('should maintain FIFO order during continuous additions', () => {
      for (let i = 0; i < 10; i++) {
        window.add({
          id: String(i),
          content: `Content ${i}`,
          timestamp: Date.now() + i
        });
      }

      const entries = window.getAll();
      expect(entries).toHaveLength(5);
      expect(entries.map(e => e.id)).toEqual(['5', '6', '7', '8', '9']);
    });
  });

  describe('resize', () => {
    it('should increase window capacity', () => {
      window.resize(10);

      for (let i = 0; i < 8; i++) {
        window.add({
          id: String(i),
          content: `Content ${i}`,
          timestamp: Date.now() + i
        });
      }

      const entries = window.getAll();
      expect(entries).toHaveLength(8);
    });

    it('should decrease window capacity and evict excess', () => {
      for (let i = 0; i < 5; i++) {
        window.add({
          id: String(i),
          content: `Content ${i}`,
          timestamp: Date.now() + i
        });
      }

      window.resize(3);

      const entries = window.getAll();
      expect(entries).toHaveLength(3);
      expect(entries.map(e => e.id)).toEqual(['2', '3', '4']);
    });

    it('should handle resize to zero', () => {
      window.add({ id: '1', content: 'Test', timestamp: Date.now() });

      window.resize(0);

      expect(window.getAll()).toHaveLength(0);
    });

    it('should return new size', () => {
      const newSize = window.resize(7);

      expect(newSize).toBe(7);
    });
  });

  describe('phase-aware resizing', () => {
    it('should resize based on phase context', () => {
      const phaseConfig = {
        planning: 2,
        research: 3,
        writing: 4
      };

      // Planning phase
      window.resizeForPhase('planning', phaseConfig);
      window.add({ id: '1', content: 'A', timestamp: Date.now() });
      window.add({ id: '2', content: 'B', timestamp: Date.now() + 1 });
      window.add({ id: '3', content: 'C', timestamp: Date.now() + 2 });

      expect(window.getAll()).toHaveLength(2);

      // Research phase (expand)
      window.resizeForPhase('research', phaseConfig);
      window.add({ id: '4', content: 'D', timestamp: Date.now() + 3 });

      expect(window.getAll()).toHaveLength(3);

      // Writing phase (expand more)
      window.resizeForPhase('writing', phaseConfig);
      window.add({ id: '5', content: 'E', timestamp: Date.now() + 4 });
      window.add({ id: '6', content: 'F', timestamp: Date.now() + 5 });

      expect(window.getAll()).toHaveLength(4);
    });

    it('should use default size for unknown phase', () => {
      const phaseConfig = { known: 5 };

      window.resizeForPhase('unknown', phaseConfig);

      // Should use reasonable default (current size or config default)
      window.add({ id: '1', content: 'Test', timestamp: Date.now() });
      expect(window.getAll()).toHaveLength(1);
    });

    it('should handle missing phase config gracefully', () => {
      expect(() => {
        window.resizeForPhase('any-phase', {});
      }).not.toThrow();
    });
  });

  describe('auto-eviction', () => {
    it('should automatically evict when adding beyond capacity', () => {
      const entries = Array.from({ length: 7 }, (_, i) => ({
        id: String(i),
        content: `Content ${i}`,
        timestamp: Date.now() + i
      }));

      entries.forEach(e => window.add(e));

      const stored = window.getAll();
      expect(stored).toHaveLength(5);
      expect(stored[0].id).toBe('2'); // First two evicted
    });

    it('should handle rapid additions correctly', () => {
      const count = 100;

      for (let i = 0; i < count; i++) {
        window.add({
          id: String(i),
          content: `Content ${i}`,
          timestamp: Date.now() + i
        });
      }

      const entries = window.getAll();
      expect(entries).toHaveLength(5);
      expect(entries.map(e => e.id)).toEqual(['95', '96', '97', '98', '99']);
    });
  });

  describe('getAll', () => {
    it('should return all entries in order', () => {
      const entries = [
        { id: '1', content: 'First', timestamp: Date.now() },
        { id: '2', content: 'Second', timestamp: Date.now() + 1 },
        { id: '3', content: 'Third', timestamp: Date.now() + 2 }
      ];

      entries.forEach(e => window.add(e));

      const stored = window.getAll();
      expect(stored).toEqual(entries);
    });

    it('should return empty array when window is empty', () => {
      expect(window.getAll()).toEqual([]);
    });

    it('should return copy to prevent external modification', () => {
      window.add({ id: '1', content: 'Test', timestamp: Date.now() });

      const entries1 = window.getAll();
      const entries2 = window.getAll();

      expect(entries1).not.toBe(entries2); // Different array instances
      expect(entries1).toEqual(entries2); // Same content
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      window.add({ id: '1', content: 'A', timestamp: Date.now() });
      window.add({ id: '2', content: 'B', timestamp: Date.now() + 1 });

      window.clear();

      expect(window.getAll()).toHaveLength(0);
    });

    it('should allow new additions after clear', () => {
      window.add({ id: '1', content: 'Before', timestamp: Date.now() });
      window.clear();
      window.add({ id: '2', content: 'After', timestamp: Date.now() });

      const entries = window.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('2');
    });
  });

  describe('size', () => {
    it('should return current number of entries', () => {
      expect(window.size()).toBe(0);

      window.add({ id: '1', content: 'A', timestamp: Date.now() });
      expect(window.size()).toBe(1);

      window.add({ id: '2', content: 'B', timestamp: Date.now() + 1 });
      expect(window.size()).toBe(2);
    });

    it('should reflect capacity limits', () => {
      for (let i = 0; i < 10; i++) {
        window.add({
          id: String(i),
          content: `Content ${i}`,
          timestamp: Date.now() + i
        });
      }

      expect(window.size()).toBe(5); // Max capacity
    });
  });

  describe('isFull', () => {
    it('should return false when window has space', () => {
      window.add({ id: '1', content: 'A', timestamp: Date.now() });

      expect(window.isFull()).toBe(false);
    });

    it('should return true when window is at capacity', () => {
      for (let i = 0; i < 5; i++) {
        window.add({
          id: String(i),
          content: `Content ${i}`,
          timestamp: Date.now() + i
        });
      }

      expect(window.isFull()).toBe(true);
    });

    it('should update after resize', () => {
      for (let i = 0; i < 5; i++) {
        window.add({
          id: String(i),
          content: `Content ${i}`,
          timestamp: Date.now() + i
        });
      }

      expect(window.isFull()).toBe(true);

      window.resize(10);
      expect(window.isFull()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very small window size', () => {
      window.resize(1);

      window.add({ id: '1', content: 'A', timestamp: Date.now() });
      window.add({ id: '2', content: 'B', timestamp: Date.now() + 1 });

      const entries = window.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('2');
    });

    it('should handle large window size', () => {
      window.resize(10000);

      for (let i = 0; i < 5000; i++) {
        window.add({
          id: String(i),
          content: `Content ${i}`,
          timestamp: Date.now() + i
        });
      }

      expect(window.size()).toBe(5000);
    });

    it('should handle duplicate IDs', () => {
      window.add({ id: '1', content: 'First', timestamp: Date.now() });
      window.add({ id: '1', content: 'Second', timestamp: Date.now() + 1 });

      const entries = window.getAll();
      expect(entries).toHaveLength(2); // Both stored (no deduplication)
    });

    it('should handle entries with same timestamp', () => {
      const timestamp = Date.now();

      window.add({ id: '1', content: 'A', timestamp });
      window.add({ id: '2', content: 'B', timestamp });
      window.add({ id: '3', content: 'C', timestamp });

      expect(window.size()).toBe(3);
    });
  });

  describe('performance', () => {
    it('should handle rapid additions efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        window.add({
          id: String(i),
          content: `Content ${i}`,
          timestamp: Date.now() + i
        });
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    it('should retrieve entries quickly', () => {
      for (let i = 0; i < 5; i++) {
        window.add({
          id: String(i),
          content: `Content ${i}`,
          timestamp: Date.now() + i
        });
      }

      const start = performance.now();
      const entries = window.getAll();
      const duration = performance.now() - start;

      expect(entries).toHaveLength(5);
      expect(duration).toBeLessThan(1);
    });
  });

  describe('integration scenarios', () => {
    it('should support workflow phase transitions', () => {
      const phaseConfigs = {
        planning: 2,
        research: 3,
        writing: 4
      };

      // Planning phase
      window.resizeForPhase('planning', phaseConfigs);
      window.add({ id: 'plan-1', content: 'Planning task 1', timestamp: Date.now() });
      window.add({ id: 'plan-2', content: 'Planning task 2', timestamp: Date.now() + 1 });

      expect(window.size()).toBe(2);

      // Transition to research
      window.resizeForPhase('research', phaseConfigs);
      window.add({ id: 'research-1', content: 'Research task 1', timestamp: Date.now() + 2 });

      expect(window.size()).toBe(3);
      expect(window.getAll()[0].id).toBe('plan-1');

      // Transition to writing (keeps recent context)
      window.resizeForPhase('writing', phaseConfigs);
      window.add({ id: 'write-1', content: 'Writing task 1', timestamp: Date.now() + 3 });

      expect(window.size()).toBe(4);
    });
  });
});
