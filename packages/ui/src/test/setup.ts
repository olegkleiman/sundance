import { expect, vi } from 'vitest';
import matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// Use type assertion to avoid TypeScript errors
const ResizeObserverMock = ResizeObserverStub as unknown as typeof ResizeObserver;

global.ResizeObserver = ResizeObserverMock;

// Mock scrollTo
Object.defineProperty(global, 'scrollTo', { value: vi.fn(), writable: true });
