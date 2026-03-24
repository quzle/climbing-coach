import '@testing-library/jest-dom'

// ---------------------------------------------------------------------------
// Mock next/navigation
// Components that call useRouter, usePathname, or useSearchParams will get
// these no-op implementations instead of crashing in the test environment.
// ---------------------------------------------------------------------------
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

// ---------------------------------------------------------------------------
// Mock next/headers
// Server components that call cookies() will get an empty cookie store.
// ---------------------------------------------------------------------------
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    getAll: jest.fn(() => []),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(() => false),
  })),
}))
