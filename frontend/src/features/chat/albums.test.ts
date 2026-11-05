import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { groupAlbums } from './albums.ts'

const msg = (id: string, type: string, sender: string, sec: number, replyTo?: string) => ({ id, type, sender, sentDate: new Date(Date.UTC(2026, 10, 5, 3, 0, sec)).toISOString(), replyTo })

describe('groupAlbums', () => {
  it('ảnh liền nhau của cùng người gộp thành album, ảnh sau bị ẩn khỏi danh sách', () => {
    const { byFirst, hidden } = groupAlbums([msg('a', 'Image', 'COUPLE', 0), msg('b', 'Image', 'COUPLE', 2), msg('c', 'Image', 'COUPLE', 4)])
    assert.deepEqual(byFirst.get('a')?.map((m) => m.id), ['a', 'b', 'c'])
    assert.deepEqual([...hidden], ['b', 'c'])
  })
  it('ngắt album khi đổi người gửi, có tin chữ xen giữa, hoặc ảnh lẻ', () => {
    const { byFirst } = groupAlbums([msg('a', 'Image', 'COUPLE', 0), msg('b', 'Image', 'VENDOR', 1), msg('c', 'Text', 'VENDOR', 2), msg('d', 'Image', 'VENDOR', 3)])
    assert.equal(byFirst.size, 0)
  })
  it('ảnh đã thu hồi không vào album', () => {
    const { byFirst } = groupAlbums([msg('a', 'Image', 'COUPLE', 0), { ...msg('b', 'Image', 'COUPLE', 1), recalled: true }])
    assert.equal(byFirst.size, 0)
  })
  it('cách nhau quá 2 phút hoặc ảnh sau là trả lời một tin thì tách album', () => {
    const { byFirst } = groupAlbums([msg('a', 'Image', 'COUPLE', 0), msg('b', 'Image', 'COUPLE', 1), msg('c', 'Image', 'COUPLE', 200), msg('d', 'Image', 'COUPLE', 201, 'x')])
    assert.deepEqual([...byFirst.keys()], ['a'])
  })
})
