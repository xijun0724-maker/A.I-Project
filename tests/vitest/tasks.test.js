import { describe, it, expect } from 'vitest';
import { effort, remainingMinutes, progress, priority } from '../../src/domain/tasks.js';

describe('effort', () => {
  it('returns base effort for unknown type', () => {
    const result = effort('other', null, null);
    expect(result).toBeGreaterThanOrEqual(15);
  });

  it('scales with weight', () => {
    const low = effort('assignment', 10, null);
    const high = effort('assignment', 90, null);
    expect(high).toBeGreaterThan(low);
  });

  it('scales with points', () => {
    const low = effort('assignment', null, 5);
    const high = effort('assignment', null, 30);
    expect(high).toBeGreaterThan(low);
  });

  it('returns at least 15 minutes', () => {
    const result = effort('reading', 1, null);
    expect(result).toBeGreaterThanOrEqual(15);
  });

  it('rounds to nearest 5', () => {
    const result = effort('assignment', 50, null);
    expect(result % 5).toBe(0);
  });
});

describe('remainingMinutes', () => {
  it('returns effort for task with no subtasks', () => {
    const e = { type: 'assignment', weight: 50, subtasks: [], status: 'pending' };
    const result = remainingMinutes(e);
    expect(result).toBeGreaterThanOrEqual(15);
  });

  it('returns 0 for done task with no subtasks', () => {
    const e = { type: 'assignment', subtasks: [], status: 'done' };
    expect(remainingMinutes(e)).toBe(0);
  });

  it('sums incomplete subtask minutes', () => {
    const e = {
      type: 'assignment',
      subtasks: [
        { done: false, minutes: 30 },
        { done: true, minutes: 20 },
        { done: false, minutes: 45 },
      ],
    };
    expect(remainingMinutes(e)).toBe(75);
  });
});

describe('progress', () => {
  it('returns 0 for pending task with no subtasks', () => {
    const e = { type: 'assignment', subtasks: [], status: 'pending' };
    expect(progress(e)).toBe(0);
  });

  it('returns 100 for done task with no subtasks', () => {
    const e = { type: 'assignment', subtasks: [], status: 'done' };
    expect(progress(e)).toBe(100);
  });

  it('calculates subtask progress', () => {
    const e = {
      subtasks: [
        { done: true },
        { done: true },
        { done: false },
        { done: false },
      ],
    };
    expect(progress(e)).toBe(50);
  });

  it('returns 100 when all subtasks done', () => {
    const e = {
      subtasks: [
        { done: true },
        { done: true },
      ],
    };
    expect(progress(e)).toBe(100);
  });
});

describe('priority', () => {
  it('returns score and breakdown', () => {
    const e = {
      type: 'assignment',
      due: new Date(Date.now() + 3 * 86400000).toISOString(),
      weight: 80,
      subtasks: [{ done: false, minutes: 60 }],
    };
    const p = priority(e);
    expect(p).toHaveProperty('score');
    expect(p).toHaveProperty('urgency');
    expect(p).toHaveProperty('weight');
    expect(p).toHaveProperty('effortScore');
    expect(p.score).toBeGreaterThanOrEqual(0);
    expect(p.score).toBeLessThanOrEqual(100);
  });

  it('higher urgency for closer deadlines', () => {
    const soon = {
      type: 'assignment',
      due: new Date(Date.now() + 1 * 86400000).toISOString(),
      weight: 50,
      subtasks: [],
    };
    const later = {
      type: 'assignment',
      due: new Date(Date.now() + 14 * 86400000).toISOString(),
      weight: 50,
      subtasks: [],
    };
    expect(priority(soon).urgency).toBeGreaterThan(priority(later).urgency);
  });

  it('higher weight gives higher weight score', () => {
    const low = { type: 'assignment', due: null, weight: 20, subtasks: [] };
    const high = { type: 'assignment', due: null, weight: 90, subtasks: [] };
    expect(priority(high).weight).toBeGreaterThan(priority(low).weight);
  });
});
