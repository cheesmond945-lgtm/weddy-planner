import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyReaction, nextReaction, withMyReaction } from './reactions.ts'

describe('withMyReaction', () => {
  it('thả mới: thêm emoji, đánh dấu của mình', () => {
    assert.deepEqual(withMyReaction([], '❤️'), [{ emoji: '❤️', count: 1, mine: true }])
  })
  it('đổi emoji: bớt ở emoji cũ (hết người thì bỏ), cộng ở emoji mới, giữ thứ tự', () => {
    const out = withMyReaction([{ emoji: '👍', count: 1, mine: true }, { emoji: '❤️', count: 1, mine: false }], '😆')
    assert.deepEqual(out, [{ emoji: '❤️', count: 1, mine: false }, { emoji: '😆', count: 1, mine: true }])
  })
  it('gỡ: chỉ bớt phần của mình', () => {
    assert.deepEqual(withMyReaction([{ emoji: '❤️', count: 2, mine: true }], null), [{ emoji: '❤️', count: 1, mine: false }])
  })
})

describe('nextReaction / applyReaction', () => {
  it('bấm lại đúng emoji đang thả là gỡ', () => {
    assert.equal(nextReaction([{ emoji: '❤️', count: 1, mine: true }], '❤️'), null)
    assert.equal(nextReaction([{ emoji: '❤️', count: 1, mine: true }], '👍'), '👍')
  })
  it('chỉ đổi đúng tin', () => {
    const out = applyReaction([{ id: 'a' }, { id: 'b' }], 'b', '😮')
    assert.deepEqual(out, [{ id: 'a' }, { id: 'b', reactions: [{ emoji: '😮', count: 1, mine: true }] }])
  })
})
