import React from 'react'
import { render, screen } from '@/lib/test-utils'
import { BottomNav } from './BottomNav'

// =============================================================================
// MOCKS
// =============================================================================

const mockUsePathname = jest.fn()

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
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
  it('renders all 6 navigation tabs', () => {
    mockUsePathname.mockReturnValue('/')
    render(<BottomNav />)

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Check-in')).toBeInTheDocument()
    expect(screen.getByText('Log')).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
  })

  it('renders correct hrefs for each tab', () => {
    mockUsePathname.mockReturnValue('/')
    render(<BottomNav />)

    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /check-in/i })).toHaveAttribute('href', '/readiness')
    expect(screen.getByRole('link', { name: /^log$/i })).toHaveAttribute('href', '/session/log')
    expect(screen.getByRole('link', { name: /^chat$/i })).toHaveAttribute('href', '/chat')
    expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute('href', '/history')
    expect(screen.getByRole('link', { name: /^profile$/i })).toHaveAttribute('href', '/profile')
  })

  it('applies active styles to the Home tab when on /', () => {
    mockUsePathname.mockReturnValue('/')
    render(<BottomNav />)

    const homeLink = screen.getByRole('link', { name: /home/i })
    expect(homeLink).toHaveClass('text-blue-600')
    expect(homeLink).toHaveClass('font-semibold')
  })

  it('does not apply active styles to Home tab when on another route', () => {
    mockUsePathname.mockReturnValue('/readiness')
    render(<BottomNav />)

    const homeLink = screen.getByRole('link', { name: /home/i })
    expect(homeLink).not.toHaveClass('text-blue-600')
  })

  it('applies active styles to Check-in tab when on /readiness', () => {
    mockUsePathname.mockReturnValue('/readiness')
    render(<BottomNav />)

    const checkinLink = screen.getByRole('link', { name: /check-in/i })
    expect(checkinLink).toHaveClass('text-blue-600')
  })

  it('applies active styles to Log tab when on /session/log', () => {
    mockUsePathname.mockReturnValue('/session/log')
    render(<BottomNav />)

    const logLink = screen.getByRole('link', { name: /^log$/i })
    expect(logLink).toHaveClass('text-blue-600')
  })

  it('applies active styles to Chat tab when on /chat', () => {
    mockUsePathname.mockReturnValue('/chat')
    render(<BottomNav />)

    const chatLink = screen.getByRole('link', { name: /^chat$/i })
    expect(chatLink).toHaveClass('text-blue-600')
  })

  it('applies active styles to History tab when on /history', () => {
    mockUsePathname.mockReturnValue('/history')
    render(<BottomNav />)

    const historyLink = screen.getByRole('link', { name: /history/i })
    expect(historyLink).toHaveClass('text-blue-600')
  })

  it('applies active styles to Profile tab when on /profile', () => {
    mockUsePathname.mockReturnValue('/profile')
    render(<BottomNav />)

    const profileLink = screen.getByRole('link', { name: /^profile$/i })
    expect(profileLink).toHaveClass('text-blue-600')
  })

  it('only one tab is active at a time', () => {
    mockUsePathname.mockReturnValue('/chat')
    render(<BottomNav />)

    const allLinks = screen.getAllByRole('link')
    const activeLinks = allLinks.filter((link) => link.classList.contains('text-blue-600'))
    expect(activeLinks).toHaveLength(1)
  })
})
