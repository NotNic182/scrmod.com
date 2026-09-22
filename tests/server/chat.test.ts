import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'

const MSG = { source: 'ingame', id: 1, steam_id: '76561199075924855', discord_id: '42', display_name: 'Dopex', rating: 1440, title: 'Beginner V', title_color: '#4D1376', channel: 'ru', message: 'hi', timestamp: '2026-09-05T10:23:16Z' }

describe('chat', () => {
  it('is hidden unless the chat feature is on', async () => {
    const { app, fake } = makeApp({ '/chat/recent': { messages: [MSG] } })
    expect((await app.request('/api/chat/recent')).status).toBe(404)
    expect(fake.calls.length).toBe(0)
  })

  it('masks discord ids and forwards limit/channels when enabled', async () => {
    const { app, fake } = makeApp({ '/chat/recent': { messages: [MSG] } }, { SCR_FEATURES: 'chat' })
    const body = await (await app.request('/api/chat/recent?limit=10&channels=global,ru;DROP')).json()
    expect(body.data.messages[0]).not.toHaveProperty('discord_id')
    expect(body.data.messages[0].display_name).toBe('Dopex')
    expect(Object.fromEntries(fake.calls[0].url.searchParams)).toEqual({ limit: '10', channels: 'global' })
  })
})
