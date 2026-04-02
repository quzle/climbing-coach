/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '\\.integration\\.test\\.(ts|tsx)$',
  ],
  moduleNameMapper: {
    // Handle the @/* tsconfig path alias
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock CSS modules
    '\\.module\\.(css|scss|sass)$': 'identity-obj-proxy',
    // Mock plain CSS imports
    '\\.(css|scss|sass)$': '<rootDir>/__mocks__/styleMock.ts',
    // Mock static file imports (images, fonts, svg, etc.)
    '\\.(jpg|jpeg|png|gif|webp|svg|ico|woff|woff2|ttf|otf|eot)$':
      '<rootDir>/__mocks__/fileMock.ts',
    // ESM-only packages: redirect to CJS-compatible mocks
    '^react-markdown$': '<rootDir>/__mocks__/react-markdown.tsx',
    '^rehype-sanitize$': '<rootDir>/__mocks__/rehype-sanitize.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
  },
}

module.exports = config
