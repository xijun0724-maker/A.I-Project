import { describe, it, expect } from 'vitest';
import { uid, esc, clamp, sum, uniq, groupBy, sortBy, pct, minutesToHM, fmtBytes, csv, slug } from '../../src/utils/helpers.js';

describe('uid', () => {
  it('generates unique IDs with default prefix', () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^id_/);
  });

  it('generates unique IDs with custom prefix', () => {
    const id = uid('task');
    expect(id).toMatch(/^task_/);
  });
});

describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('handles null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});

describe('clamp', () => {
  it('clamps below min', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it('clamps above max', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('returns value within range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('handles float values', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe('sum', () => {
  it('sums array of numbers', () => {
    expect(sum([1, 2, 3, 4])).toBe(10);
  });

  it('sums with mapping function', () => {
    expect(sum([{ v: 1 }, { v: 2 }], x => x.v)).toBe(3);
  });

  it('returns 0 for empty array', () => {
    expect(sum([])).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(sum(null)).toBe(0);
  });
});

describe('uniq', () => {
  it('removes duplicates', () => {
    expect(uniq([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
  });

  it('preserves order', () => {
    expect(uniq([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
  });
});

describe('groupBy', () => {
  it('groups by function', () => {
    const items = [{ type: 'a', v: 1 }, { type: 'b', v: 2 }, { type: 'a', v: 3 }];
    const result = groupBy(items, x => x.type);
    expect(result.a).toHaveLength(2);
    expect(result.b).toHaveLength(1);
  });

  it('groups by property name', () => {
    const items = [{ type: 'a' }, { type: 'b' }, { type: 'a' }];
    const result = groupBy(items, 'type');
    expect(result.a).toHaveLength(2);
  });
});

describe('sortBy', () => {
  it('sorts ascending by default', () => {
    expect(sortBy([3, 1, 2], x => x)).toEqual([1, 2, 3]);
  });

  it('sorts descending with dir=-1', () => {
    expect(sortBy([3, 1, 2], x => x, -1)).toEqual([3, 2, 1]);
  });

  it('handles null values', () => {
    expect(sortBy([null, 1, null, 2], x => x)).toEqual([1, 2, null, null]);
  });
});

describe('pct', () => {
  it('calculates percentage', () => {
    expect(pct(50, 100)).toBe(50);
  });

  it('returns 0 for zero denominator', () => {
    expect(pct(5, 0)).toBe(0);
  });

  it('clamps to 0-100', () => {
    expect(pct(200, 100)).toBe(100);
    expect(pct(-10, 100)).toBe(0);
  });
});

describe('minutesToHM', () => {
  it('formats minutes only', () => {
    expect(minutesToHM(45)).toBe('45m');
  });

  it('formats hours and minutes', () => {
    expect(minutesToHM(90)).toBe('1h 30m');
  });

  it('formats exact hours', () => {
    expect(minutesToHM(120)).toBe('2h');
  });

  it('handles 0', () => {
    expect(minutesToHM(0)).toBe('0m');
  });
});

describe('fmtBytes', () => {
  it('formats bytes', () => {
    expect(fmtBytes(0)).toBe('0 B');
    expect(fmtBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(fmtBytes(1024)).toBe('1.0 KB');
  });
});

describe('csv', () => {
  it('converts rows to CSV', () => {
    const result = csv([['a', 'b'], ['c', 'd']]);
    expect(result).toBe('a,b\nc,d');
  });

  it('escapes commas', () => {
    const result = csv([['hello, world']]);
    expect(result).toBe('"hello, world"');
  });
});

describe('slug', () => {
  it('creates URL-safe slug', () => {
    expect(slug('Hello World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slug('Hello! @World#')).toBe('hello-world');
  });

  it('handles empty string', () => {
    expect(slug('')).toBe('');
  });
});
