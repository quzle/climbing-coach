import React from 'react'
import { render, screen } from '@/lib/test-utils'
import { AuthProvider, type ClientAuthUser } from '@/components/providers/auth-provider'
import { UserIndicator } from './UserIndicator'

jest.mock('./LogoutButton', () => ({
  LogoutButton: () => <button type="button">Log out</button>,
}))

jest.mock('next/link', () => {
  const MockLink = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  )
  MockLink.displayName = 'Link'
  return MockLink
})

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

function renderUserIndicator(initialUser: ClientAuthUser | null) {
  return render(
    <AuthProvider initialUser={initialUser}>
      <UserIndicator />
    </AuthProvider>,
  )
}

describe('UserIndicator', () => {
  it('shows the user display name, email, account link, and logout action', () => {
    renderUserIndicator(makeUser())

    expect(screen.getByText('Test Climber')).toBeInTheDocument()
    expect(screen.getByText('climber@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /account/i })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })

  it('falls back to email when no display name exists', () => {
    renderUserIndicator(makeUser({ displayName: null }))

    expect(screen.getByText('climber@example.com')).toBeInTheDocument()
  })

  it('renders nothing when unauthenticated', () => {
    renderUserIndicator(null)

    expect(screen.queryByRole('link', { name: /account/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument()
  })
})