import { afterEach } from 'vitest';

const makeStorageMock = () => {
  let store = {};
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
};

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

globalThis.localStorage = localStorageMock;
// Node >= 24 ships a real sessionStorage, older runners do not. Pin both so
// src/utils/secure.js behaves identically on every Node version in CI.
globalThis.sessionStorage = sessionStorageMock;

afterEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
});
