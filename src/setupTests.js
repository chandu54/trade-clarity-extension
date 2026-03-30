import { vi, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock chrome API globally
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      }
    }
  }
};

// Mock localStorage
if (typeof window !== 'undefined' && !window.localStorage) {
  const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    clear: vi.fn(),
    removeItem: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
}

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));
