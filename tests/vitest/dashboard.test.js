import { describe, it, expect, beforeEach } from 'vitest';

import { Store } from '../../src/core/store.js';
import { Dashboard } from '../../src/domain/dashboard.js';

beforeEach(() => {
  Store.resetAll();
});

describe('Dashboard.letter', () => {
  it('returns null for null', () => {
    expect(Dashboard.letter(null)).toBeNull();
  });

  it('returns A for 92+', () => {
    expect(Dashboard.letter(95)).toBe('A');
    expect(Dashboard.letter(92)).toBe('A');
  });

  it('returns A- for 88-91', () => {
    expect(Dashboard.letter(90)).toBe('A-');
    expect(Dashboard.letter(88)).toBe('A-');
  });

  it('returns B+ for 84-87', () => {
    expect(Dashboard.letter(85)).toBe('B+');
  });

  it('returns B for 80-83', () => {
    expect(Dashboard.letter(80)).toBe('B');
  });

  it('returns F for below 60', () => {
    expect(Dashboard.letter(50)).toBe('F');
    expect(Dashboard.letter(0)).toBe('F');
  });
});

describe('Dashboard.kpis', () => {
  it('returns expected shape', () => {
    const k = Dashboard.kpis();
    expect(k).toHaveProperty('courses');
    expect(k).toHaveProperty('open');
    expect(k).toHaveProperty('done');
    expect(k).toHaveProperty('overdue');
    expect(k).toHaveProperty('due7');
    expect(k).toHaveProperty('completion');
    expect(k).toHaveProperty('avgGrade');
    expect(k).toHaveProperty('remainingMinutes');
  });

  it('counts open events', () => {
    Store.db.events = [
      { id: 'e1', status: 'open', courseId: null, type: 'assignment', subtasks: [] },
      { id: 'e2', status: 'done', courseId: null, type: 'quiz', subtasks: [] },
    ];
    const k = Dashboard.kpis();
    expect(k.open).toBe(1);
    expect(k.done).toBe(1);
  });

  it('counts overdue events', () => {
    Store.db.events = [{
      id: 'e1', status: 'open', courseId: null, type: 'assignment',
      due: new Date(Date.now() - 2 * 86400000).toISOString(), subtasks: [],
    }];
    const k = Dashboard.kpis();
    expect(k.overdue).toBe(1);
  });
});

describe('Dashboard.courseGrade', () => {
  it('returns null grade when no graded events', () => {
    Store.db.events = [{ id: 'e1', courseId: 'c1', grade: null }];
    const g = Dashboard.courseGrade('c1');
    expect(g.grade).toBeNull();
    expect(g.count).toBe(0);
  });

  it('calculates simple average', () => {
    Store.db.events = [
      { id: 'e1', courseId: 'c1', grade: 80, weight: null },
      { id: 'e2', courseId: 'c1', grade: 90, weight: null },
    ];
    const g = Dashboard.courseGrade('c1');
    expect(g.grade).toBe(85);
    expect(g.count).toBe(2);
    expect(g.weighted).toBe(false);
  });

  it('calculates weighted average', () => {
    Store.db.events = [
      { id: 'e1', courseId: 'c1', grade: 80, weight: 30 },
      { id: 'e2', courseId: 'c1', grade: 90, weight: 70 },
    ];
    const g = Dashboard.courseGrade('c1');
    expect(g.grade).toBe(87);
    expect(g.weighted).toBe(true);
  });
});

describe('Dashboard.upcoming', () => {
  it('returns sorted upcoming events', () => {
    const soon = new Date(Date.now() + 1 * 86400000).toISOString();
    const later = new Date(Date.now() + 7 * 86400000).toISOString();
    Store.db.events = [
      { id: 'e1', status: 'open', due: later, courseId: null, type: 'assignment', subtasks: [] },
      { id: 'e2', status: 'open', due: soon, courseId: null, type: 'quiz', subtasks: [] },
    ];
    const up = Dashboard.upcoming(5);
    expect(up.length).toBe(2);
    expect(up[0].id).toBe('e2');
    expect(up[1].id).toBe('e1');
  });

  it('excludes done events', () => {
    Store.db.events = [
      { id: 'e1', status: 'done', due: new Date().toISOString(), courseId: null },
    ];
    expect(Dashboard.upcoming(5)).toHaveLength(0);
  });
});

describe('Dashboard.readiness', () => {
  it('returns null when term dates missing', () => {
    Store.db.settings.termStart = '';
    Store.db.settings.termEnd = '';
    expect(Dashboard.readiness()).toBeNull();
  });

  it('returns timePct, workPct, week', () => {
    const now = new Date();
    Store.db.settings.termStart = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    Store.db.settings.termEnd = new Date(now.getTime() + 60 * 86400000).toISOString().slice(0, 10);
    const r = Dashboard.readiness();
    expect(r).toHaveProperty('timePct');
    expect(r).toHaveProperty('workPct');
    expect(r).toHaveProperty('week');
    expect(r.timePct).toBeGreaterThanOrEqual(0);
    expect(r.timePct).toBeLessThanOrEqual(100);
  });
});
