import assert from 'node:assert/strict'
import { snapToGrid, snapOffset, liveOffsetStyle, EDITOR_SNAP_GRID_PX } from './layoutOffsets.mjs'

assert.equal(EDITOR_SNAP_GRID_PX, 8)
assert.equal(snapToGrid(13), 16)
assert.equal(snapToGrid(13, 8, false), 13)
assert.deepEqual(snapOffset({ x: 13, y: -5, scale: 1.1 }), { x: 16, y: -8, scale: 1.1 })

const moved = liveOffsetStyle({ x: 10, y: 0, scale: 1 })
assert.ok(moved?.transform?.includes('translate(10px'))

const none = liveOffsetStyle({ x: 0, y: 0, scale: 1 })
assert.equal(none, undefined)

console.log('layoutOffsets.test.mjs: ok')
