import { afterEach } from 'vitest';

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

globalThis.localStorage = localStorageMock;

afterEach(() => {
  localStorageMock.clear();
});
