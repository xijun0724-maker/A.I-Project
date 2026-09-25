import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'journeyai.secure.v2';

const sessionStorageMock = vi.hoisted(() => {
  let store = {};
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    _store: () => store,
  };
});

vi.stubGlobal('sessionStorage', sessionStorageMock);

import { setApiKey, getApiKey, clearApiKey, hasApiKey, hydrateKey, stripKey } from '../../src/utils/secure.js';

describe('secure.js', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
  });

  describe('setApiKey / getApiKey', () => {
    it('stores and retrieves a Gemini key (default provider)', () => {
      setApiKey('sk-test-123');
      expect(getApiKey()).toBe('sk-test-123');
    });

    it('stores a key under a specific provider namespace', () => {
      setApiKey('openai-key-123', 'openai');
      expect(getApiKey('openai')).toBe('openai-key-123');
      expect(getApiKey('gemini')).toBe('');
    });

    it('deletes the key when called with empty string', () => {
      setApiKey('sk-abc-1234');
      expect(getApiKey()).toBe('sk-abc-1234');
      setApiKey('');
      expect(getApiKey()).toBe('');
    });

    it('deletes the key when called with null', () => {
      setApiKey('sk-abc-1234');
      setApiKey(null);
      expect(getApiKey()).toBe('');
    });

    it('stores both namespaced and legacy apiKey for Gemini', () => {
      setApiKey('g-key-12345', 'gemini');
      const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
      expect(raw.keys.gemini.value).toBe('g-key-12345');
      expect(raw.keys.apiKey.value).toBe('g-key-12345');
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
      setApiKey('g-key-12345', 'gemini');
      setApiKey('o-key-12345', 'openai');
      clearApiKey('openai');
      expect(getApiKey('gemini')).toBe('g-key-12345');
      expect(getApiKey('openai')).toBe('');
    });
  });

  describe('hasApiKey', () => {
    it('returns false when no key is stored', () => {
      expect(hasApiKey()).toBe(false);
    });

    it('returns true after setApiKey', () => {
      setApiKey('sk-has-1234');
      expect(hasApiKey()).toBe(true);
    });
  });

  describe('hydrateKey', () => {
    it('sets settings.apiKey from sessionStorage when available', () => {
      setApiKey('sk-hydrate-123');
      const settings = { provider: 'gemini', apiKey: '' };
      hydrateKey(settings);
      expect(settings.apiKey).toBe('sk-hydrate-123');
    });

    it('leaves settings.apiKey empty when nothing stored', () => {
      const settings = { provider: 'gemini', apiKey: '' };
      hydrateKey(settings);
      expect(settings.apiKey).toBeUndefined();
    });

    it('handles null settings gracefully', () => {
      expect(() => hydrateKey(null)).not.toThrow();
    });

    it('reads the correct provider namespace', () => {
      setApiKey('o-hydrate-123', 'openai');
      const settings = { provider: 'openai', apiKey: '' };
      hydrateKey(settings);
      expect(settings.apiKey).toBe('o-hydrate-123');
    });
  });

  describe('stripKey', () => {
    it('returns a copy with settings.apiKey cleared', () => {
      const db = { settings: { apiKey: 'sk-secret' } };
      expect(stripKey(db).settings.apiKey).toBe('');
    });

    it('leaves the live object untouched', () => {
      const db = { settings: { apiKey: 'sk-secret', provider: 'gemini' } };
      stripKey(db);
      expect(db.settings.apiKey).toBe('sk-secret');
    });

    it('keeps the rest of the database intact', () => {
      const db = {
        settings: { apiKey: 'sk-secret', provider: 'openrouter' },
        courses: [{ id: 'c1' }],
        chat: [{ role: 'user', content: 'hi' }],
      };
      const out = stripKey(db);
      expect(out.settings.provider).toBe('openrouter');
      expect(out.courses).toBe(db.courses);
      expect(out.chat).toBe(db.chat);
      expect(out).not.toBe(db);
      expect(out.settings).not.toBe(db.settings);
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
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.setItem = vi.fn(() => { throw new Error('quota'); });
      expect(() => setApiKey('sk-fail-123')).not.toThrow();
      sessionStorage.setItem = originalSetItem;
    });

    it('degrades gracefully when sessionStorage.getItem throws', () => {
      const originalGetItem = sessionStorage.getItem;
      sessionStorage.getItem = vi.fn(() => { throw new Error('blocked'); });
      expect(getApiKey()).toBe('');
      expect(hasApiKey()).toBe(false);
      sessionStorage.getItem = originalGetItem;
    });

    it('degrades gracefully when stored data is corrupted JSON', () => {
      sessionStorage.setItem(STORAGE_KEY, '{{bad json');
      expect(getApiKey()).toBe('');
      expect(hasApiKey()).toBe(false);
    });
  });
});