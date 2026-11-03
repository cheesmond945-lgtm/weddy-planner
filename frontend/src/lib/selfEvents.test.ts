/*
 * Unit test cho selfEvents.ts (bỏ qua sự kiện realtime do chính mình gây ra), chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isSelfEvent, markSelf } from './selfEvents.ts'

describe('selfEvents', () => {
  it('việc vừa tự đổi thì bị bỏ qua; việc khác thì không', () => {
    markSelf('task-1', 1_000)
    assert.equal(isSelfEvent('task-1', 2_000), true)
    assert.equal(isSelfEvent('task-2', 2_000), false)
    assert.equal(isSelfEvent(undefined), false)
    assert.equal(isSelfEvent(null), false)
  })

  it('quá vài giây thì không còn bị bỏ qua (sự kiện của phiên khác vẫn tải lại)', () => {
    markSelf('task-3', 1_000)
    assert.equal(isSelfEvent('task-3', 1_000 + 9_999), true)
    assert.equal(isSelfEvent('task-3', 1_000 + 10_001), false)
    assert.equal(isSelfEvent('task-3', 1_000 + 10_002), false)
  })
})
