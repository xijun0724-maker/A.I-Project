import { describe, it, expect } from 'vitest';
import { progress, remainingMinutes } from '../../src/domain/tasks.js';

describe('tasks - progress', () => {
  it('returns 0 for empty subtasks', () => {
    expect(progress({ subtasks: [] })).toBe(0);
  });

  it('returns 0 when no subtasks are done', () => {
    expect(progress({ subtasks: [{ done: false }, { done: false }] })).toBe(0);
  });

  it('returns 100 when all subtasks are done', () => {
    expect(progress({ subtasks: [{ done: true }, { done: true }] })).toBe(100);
  });

  it('returns partial progress', () => {
    const result = progress({ subtasks: [{ done: true }, { done: false }, { done: false }] });
    expect(result).toBe(33);
  });
});

describe('tasks - remainingMinutes', () => {
  it('returns 0 for done tasks', () => {
    expect(remainingMinutes({ status: 'done', type: 'essay', subtasks: [] })).toBe(0);
  });

  it('returns base estimate for tasks without subtasks', () => {
    const result = remainingMinutes({ status: 'open', type: 'essay', subtasks: [] });
    expect(result).toBeGreaterThan(0);
  });
});
