import React from 'react'
import { render, screen } from '@/lib/test-utils'
import { AuthProvider, type ClientAuthUser } from '@/components/providers/auth-provider'
import { BottomNav } from './BottomNav'

// =============================================================================
// MOCKS
// =============================================================================

const mockUsePathname = jest.fn()

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

jest.mock('./UserIndicator', () => ({
  UserIndicator: () => <div>Signed in user</div>,
}))

jest.mock('../../../features.json', () => ({
  chat: true,
}))

// next/link renders a plain <a> in the test environment
jest.mock('next/link', () => {
  const MockLink = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  )
  MockLink.displayName = 'Link'
  return MockLink
})

// =============================================================================
// TESTS
// =============================================================================

describe('BottomNav', () => {
  function makeUser(overrides?: Partial<ClientAuthUser>): ClientAuthUser {
    return {
      id: 'user-123',
      email: 'climber@example.com',
      displayName: 'Test Climber',
      role: 'user',
      inviteStatus: 'active',
      ...overrides,
    }
  }

  function renderBottomNav(initialUser: ClientAuthUser | null = null) {
    return render(
      <AuthProvider initialUser={initialUser}>
        <BottomNav />
      </AuthProvider>,
    )
  }

  it('renders all 6 navigation tabs', () => {
    mockUsePathname.mockReturnValue('/')
    renderBottomNav()

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Log')).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
    expect(screen.getByText('Plan')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.queryByText('Check-in')).not.toBeInTheDocument()
  })

  it('renders correct hrefs for each tab', () => {
    mockUsePathname.mockReturnValue('/')
    renderBottomNav()

    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /^log$/i })).toHaveAttribute('href', '/session/log')
    expect(screen.getByRole('link', { name: /^chat$/i })).toHaveAttribute('href', '/chat')
    expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute('href', '/history')
    expect(screen.getByRole('link', { name: /^plan$/i })).toHaveAttribute('href', '/programme')
    expect(screen.getByRole('link', { name: /^profile$/i })).toHaveAttribute('href', '/profile')
  })

  it('applies active styles to the Home tab when on /', () => {
    mockUsePathname.mockReturnValue('/')
    renderBottomNav()

    const homeLink = screen.getByRole('link', { name: /home/i })
    expect(homeLink).toHaveClass('text-blue-600')
    expect(homeLink).toHaveClass('font-semibold')
  })

  it('does not apply active styles to Home tab when on another route', () => {
    mockUsePathname.mockReturnValue('/chat')
    renderBottomNav()

    const homeLink = screen.getByRole('link', { name: /home/i })
    expect(homeLink).not.toHaveClass('text-blue-600')
  })

  it('applies active styles to Log tab when on /session/log', () => {
    mockUsePathname.mockReturnValue('/session/log')
    renderBottomNav()

    const logLink = screen.getByRole('link', { name: /^log$/i })
    expect(logLink).toHaveClass('text-blue-600')
  })

  it('applies active styles to Chat tab when on /chat', () => {
    mockUsePathname.mockReturnValue('/chat')
    renderBottomNav()

    const chatLink = screen.getByRole('link', { name: /^chat$/i })
    expect(chatLink).toHaveClass('text-blue-600')
  })

  it('applies active styles to History tab when on /history', () => {
    mockUsePathname.mockReturnValue('/history')
    renderBottomNav()

    const historyLink = screen.getByRole('link', { name: /history/i })
    expect(historyLink).toHaveClass('text-blue-600')
  })

  it('applies active styles to Plan tab when on /programme', () => {
    mockUsePathname.mockReturnValue('/programme')
    renderBottomNav()

    const planLink = screen.getByRole('link', { name: /^plan$/i })
    expect(planLink).toHaveClass('text-blue-600')
  })

  it('applies active styles to Profile tab when on /profile', () => {
    mockUsePathname.mockReturnValue('/profile')
    renderBottomNav()

    const profileLink = screen.getByRole('link', { name: /^profile$/i })
    expect(profileLink).toHaveClass('text-blue-600')
  })

  it('only one tab is active at a time', () => {
    mockUsePathname.mockReturnValue('/chat')
    renderBottomNav()

    const allLinks = screen.getAllByRole('link')
    const activeLinks = allLinks.filter((link) => link.classList.contains('text-blue-600'))
    expect(activeLinks).toHaveLength(1)
  })

  it('renders a logout trigger for authenticated users', () => {
    mockUsePathname.mockReturnValue('/')
    renderBottomNav(makeUser())

    expect(screen.getByText('Signed in user')).toBeInTheDocument()
  })

  it('does not render on auth routes', () => {
    mockUsePathname.mockReturnValue('/auth/login')
    renderBottomNav(makeUser())

    expect(screen.queryByRole('link', { name: /home/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument()
  })

  describe('feature flags', () => {
    it('hides the Chat tab when chat feature is disabled', () => {
      const featureFlags = jest.requireMock('../../../features.json') as Record<string, boolean>
      featureFlags.chat = false

      mockUsePathname.mockReturnValue('/')
      renderBottomNav()

      expect(screen.queryByText('Chat')).not.toBeInTheDocument()
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Log')).toBeInTheDocument()
      expect(screen.getByText('History')).toBeInTheDocument()

      featureFlags.chat = true
    })

    it('shows the Chat tab when chat feature is enabled', () => {
      mockUsePathname.mockReturnValue('/')
      renderBottomNav()

      expect(screen.getByText('Chat')).toBeInTheDocument()
    })
  })
})
