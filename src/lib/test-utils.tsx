import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Global test providers
// Wrap rendered components with any app-wide providers here.
// Currently uses a plain fragment — add ThemeProvider, QueryClient, etc.
// as the app grows.
// ---------------------------------------------------------------------------
function AllProviders({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>
}

function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): ReturnType<typeof render> {
  return render(ui, { wrapper: AllProviders, ...options })
}

// Re-export everything from React Testing Library so tests only need one import.
export * from '@testing-library/react'
// Override the default render with our wrapped version.
export { customRender as render }
