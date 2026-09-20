import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApiKey, getApiKey, clearApiKey, hasApiKey, hydrateKey, stripKey } from '../../src/utils/secure.js';

const storage = {};
const mockSS = {
  getItem: vi.fn((k) => storage[k] || null),
  setItem: vi.fn((k, v) => { storage[k] = String(v); }),
  removeItem: vi.fn((k) => { delete storage[k]; }),
};
Object.defineProperty(globalThis, 'sessionStorage', { value: mockSS, writable: true });

describe('secure.js', () => {
  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    mockSS.getItem.mockClear();
    mockSS.setItem.mockClear();
  });

  describe('setApiKey / getApiKey', () => {
    it('stores and retrieves a Gemini key (default provider)', () => {
      setApiKey('sk-test-123');
      expect(getApiKey()).toBe('sk-test-123');
    });

    it('stores a key under a specific provider namespace', () => {
      setApiKey('openai-key', 'openai');
      expect(getApiKey('openai')).toBe('openai-key');
      expect(getApiKey('gemini')).toBe('');
    });

    it('deletes the key when called with empty string', () => {
      setApiKey('sk-abc');
      expect(getApiKey()).toBe('sk-abc');
      setApiKey('');
      expect(getApiKey()).toBe('');
    });

    it('deletes the key when called with null', () => {
      setApiKey('sk-abc');
      setApiKey(null);
      expect(getApiKey()).toBe('');
    });

    it('stores both namespaced and legacy apiKey for Gemini', () => {
      setApiKey('g-key', 'gemini');
      const raw = JSON.parse(storage['journeyai.secure']);
      expect(raw.gemini_apiKey).toBe('g-key');
      expect(raw.apiKey).toBe('g-key');
    });
  });

  describe('clearApiKey', () => {
    it('removes the stored key', () => {
      setApiKey('sk-clear-me');
      expect(hasApiKey()).toBe(true);
      clearApiKey();
      expect(hasApiKey()).toBe(false);
      expect(getApiKey()).toBe('');
    });

    it('only removes the target provider key', () => {
      setApiKey('g-key', 'gemini');
      setApiKey('o-key', 'openai');
      clearApiKey('openai');
      expect(getApiKey('gemini')).toBe('g-key');
      expect(getApiKey('openai')).toBe('');
    });
  });

  describe('hasApiKey', () => {
    it('returns false when no key is stored', () => {
      expect(hasApiKey()).toBe(false);
    });

    it('returns true after setApiKey', () => {
      setApiKey('sk-has');
      expect(hasApiKey()).toBe(true);
    });
  });

  describe('hydrateKey', () => {
    it('sets settings.apiKey from sessionStorage when available', () => {
      setApiKey('sk-hydrate');
      const settings = { provider: 'gemini', apiKey: '' };
      hydrateKey(settings);
      expect(settings.apiKey).toBe('sk-hydrate');
    });

    it('leaves settings.apiKey empty when nothing stored', () => {
      const settings = { provider: 'gemini', apiKey: '' };
      hydrateKey(settings);
      expect(settings.apiKey).toBe('');
    });

    it('handles null settings gracefully', () => {
      expect(() => hydrateKey(null)).not.toThrow();
    });

    it('reads the correct provider namespace', () => {
      setApiKey('o-hydrate', 'openai');
      const settings = { provider: 'openai', apiKey: '' };
      hydrateKey(settings);
      expect(settings.apiKey).toBe('o-hydrate');
    });
  });

  describe('stripKey', () => {
    it('clears db.settings.apiKey', () => {
      const db = { settings: { apiKey: 'sk-secret' } };
      stripKey(db);
      expect(db.settings.apiKey).toBe('');
    });

    it('does not throw on null db', () => {
      expect(() => stripKey(null)).not.toThrow();
    });

    it('does not throw on db without settings', () => {
      expect(() => stripKey({})).not.toThrow();
    });
  });

  describe('error resilience', () => {
    it('degrades gracefully when sessionStorage.setItem throws', () => {
      mockSS.setItem.mockImplementation(() => { throw new Error('quota'); });
      expect(() => setApiKey('sk-fail')).not.toThrow();
    });

    it('degrades gracefully when sessionStorage.getItem throws', () => {
      mockSS.getItem.mockImplementation(() => { throw new Error('blocked'); });
      expect(getApiKey()).toBe('');
      expect(hasApiKey()).toBe(false);
    });

    it('degrades gracefully when stored data is corrupted JSON', () => {
      storage['journeyai.secure'] = '{{bad json';
      expect(getApiKey()).toBe('');
      expect(hasApiKey()).toBe(false);
    });
  });
});
