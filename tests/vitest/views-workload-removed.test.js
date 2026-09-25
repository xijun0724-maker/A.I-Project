import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../../src/core/store.js';
import { dashboardView } from '../../src/views/dashboard.js';
import { tasksView } from '../../src/views/tasks.js';
import { plannerView } from '../../src/views/planner.js';

describe('Views - Removal of Work Remaining and Estimated Workload features', () => {
  beforeEach(() => {
    Store.resetAll();
    Store.db.courses = [
      { id: 'c1', title: 'Calculus I', code: 'MATH101', color: '#3b82f6' }
    ];
    Store.db.events = [
      {
        id: 'e1',
        courseId: 'c1',
        title: 'Problem Set 1',
        type: 'assignment',
        status: 'open',
        due: new Date(Date.now() + 86400000).toISOString(),
        subtasks: [
          { id: 's1', title: 'Part A', done: false, minutes: 30 },
          { id: 's2', title: 'Part B', done: true, minutes: 30 }
        ]
      }
    ];
  });

  it('dashboardView removes Work remaining, capacity, and slack while preserving academic hierarchy', () => {
    const html = dashboardView.fn();
    expect(html).not.toContain('Work remaining');
    expect(html).not.toContain('capacity');
    expect(html).not.toContain('slack');
    expect(html).toContain('Course progress');
    expect(html).toContain('To do:');
  });

  it('tasksView has no Work Remaining or Workload by Course feature elements', () => {
    const html = tasksView.fn();
    expect(html).not.toContain('Work Remaining');
    expect(html).not.toContain('estimated backlog');
    expect(html).not.toContain('Workload by Course');
    expect(html).not.toContain('course-workload-list');
    expect(html).not.toMatch(/\d+m left/);
  });

  it('plannerView has no Work Remaining or Weekly Workload elements', () => {
    const html = plannerView.fn();
    expect(html).not.toContain('Work Remaining');
    expect(html).not.toContain('Scheduled Workload');
    expect(html).not.toContain('Weekly Workload');
    expect(html).not.toContain('Total Workload');
  });
});
