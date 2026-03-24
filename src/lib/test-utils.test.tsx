import { render, screen } from '@/lib/test-utils'
import React from 'react'

describe('test-utils', () => {
  it('renders a component and finds it in the DOM', () => {
    render(<div>hello test-utils</div>)
    expect(screen.getByText('hello test-utils')).toBeInTheDocument()
  })
})
