import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Wordmark } from '../../src/web/components/Wordmark'
import { Backdrop } from '../../src/web/components/Backdrop'

describe('brand', () => {
  it('the wordmark reads as one name, SCRmod, with the logo inside it', () => {
    render(<Wordmark />)
    const mark = screen.getByRole('img', { name: 'SCRmod' })
    expect(mark.querySelector('image')?.getAttribute('href')).toMatch(/\/logo\.webp$/)
    expect(mark.querySelectorAll('path')).toHaveLength(2)
  })

  it('the backdrop is decoration only', () => {
    const { container } = render(<Backdrop />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('polygon').length).toBeGreaterThan(8)
  })
})
