import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from '../store'
import HelpModal from './HelpModal'
import PrivacyModal from './PrivacyModal'
import TermsModal from './TermsModal'

const originalUIState = useUIStore.getState()

describe('legal and help dialogs', () => {
  beforeEach(() => {
    useUIStore.setState({
      helpModalOpen: false,
      privacyModalOpen: false,
      termsModalOpen: false,
      language: 'en',
    })
  })

  afterEach(() => {
    cleanup()
    useUIStore.setState(originalUIState, true)
  })

  it.each([
    {
      name: 'Privacy Policy',
      description: 'How we handle your data',
      flag: 'privacyModalOpen',
      Component: PrivacyModal,
    },
    {
      name: 'Terms of Service',
      description: 'Usage terms and conditions',
      flag: 'termsModalOpen',
      Component: TermsModal,
    },
  ])('provides a labelled, keyboard-scrollable $name dialog', async ({
    name,
    description,
    flag,
    Component,
  }) => {
    const user = userEvent.setup()
    useUIStore.setState({ [flag]: true })
    render(<Component />)

    const dialog = screen.getByRole('dialog', { name })
    expect(dialog).toHaveAccessibleDescription(description)
    expect(screen.getByRole('region', { name })).toHaveAttribute('tabindex', '0')

    await user.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(useUIStore.getState()[flag]).toBe(false)
  })

  it('exposes accordion state and moves between help and legal dialogs intentionally', async () => {
    const user = userEvent.setup()
    useUIStore.setState({ helpModalOpen: true })
    render(<HelpModal />)

    const dialog = screen.getByRole('dialog', { name: 'Help & Support' })
    expect(dialog).toHaveAccessibleDescription('Tips and instructions for QuickNotes')
    expect(screen.getByRole('region', { name: 'Help & Support' })).toHaveAttribute(
      'tabindex',
      '0'
    )

    const gettingStarted = screen.getByRole('button', { name: 'Getting Started' })
    const editing = screen.getByRole('button', { name: 'Editing Notes' })
    expect(gettingStarted).toHaveAttribute('aria-expanded', 'true')
    expect(editing).toHaveAttribute('aria-expanded', 'false')

    await user.click(editing)
    expect(editing).toHaveAttribute('aria-expanded', 'true')
    expect(gettingStarted).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('region', { name: 'Editing Notes' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Privacy Policy' }))
    expect(useUIStore.getState()).toMatchObject({
      helpModalOpen: false,
      privacyModalOpen: true,
    })
  })
})
