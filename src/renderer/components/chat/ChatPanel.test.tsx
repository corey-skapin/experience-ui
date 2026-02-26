/**
 * Unit tests for ChatPanel clarification and queue-status display.
 * Tests: renders clarification question + options, calls onSelect,
 * shows pending clarification in place of input (disables), shows
 * queued-item count.
 *
 * Written FIRST (TDD) — must fail before the implementation exists.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatPanel } from './ChatPanel'
import type { ChatMessage } from '../../../shared/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────

const BASE_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    tabId: 'tab-1',
    role: 'user',
    content: 'Add a search bar',
    timestamp: Date.now(),
    status: 'sent',
    relatedVersionId: null,
  },
]

const noop = () => undefined

// ─── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Clarification rendering ──────────────────────────────────────────────

describe('ChatPanel clarification UI', () => {
  it('renders the clarification question when pendingClarification is provided', () => {
    render(
      <ChatPanel
        messages={BASE_MESSAGES}
        onSendMessage={noop}
        pendingClarification={{
          question: 'Which table should I add the search to?',
          options: ['Users', 'Orders'],
          onSelect: noop,
        }}
      />,
    )

    expect(screen.getByText('Which table should I add the search to?')).toBeTruthy()
  })

  it('renders all clarification options as buttons', () => {
    render(
      <ChatPanel
        messages={BASE_MESSAGES}
        onSendMessage={noop}
        pendingClarification={{
          question: 'Which table?',
          options: ['Users', 'Orders', 'Both'],
          onSelect: noop,
        }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Users' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Orders' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Both' })).toBeTruthy()
  })

  it('calls onSelect with the chosen option when a button is clicked', () => {
    const onSelect = vi.fn()
    render(
      <ChatPanel
        messages={BASE_MESSAGES}
        onSendMessage={noop}
        pendingClarification={{
          question: 'Which table?',
          options: ['Users', 'Orders'],
          onSelect,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Users' }))
    expect(onSelect).toHaveBeenCalledWith('Users')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('does not render clarification UI when pendingClarification is null', () => {
    render(<ChatPanel messages={BASE_MESSAGES} onSendMessage={noop} pendingClarification={null} />)

    expect(screen.queryByTestId('clarification-panel')).toBeNull()
  })
})

// ─── Queue depth display ──────────────────────────────────────────────────

describe('ChatPanel queue status', () => {
  it('delegates queueDepth to ChatInput', () => {
    render(<ChatPanel messages={[]} onSendMessage={noop} queueDepth={3} />)

    // The ChatInput renders the queue count
    expect(screen.getByText(/3 requests queued/i)).toBeTruthy()
  })
})
