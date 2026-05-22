import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isPrivateOrLocalIp, isVpnCheckDisabled } from '../backend/api/lib/vpnDetection.mjs'

describe('vpnDetection', () => {
  it('treats loopback and RFC1918 as private', () => {
    assert.equal(isPrivateOrLocalIp('127.0.0.1'), true)
    assert.equal(isPrivateOrLocalIp('10.0.0.5'), true)
    assert.equal(isPrivateOrLocalIp('192.168.1.2'), true)
    assert.equal(isPrivateOrLocalIp('::1'), true)
  })

  it('does not treat public IPs as private', () => {
    assert.equal(isPrivateOrLocalIp('8.8.8.8'), false)
    assert.equal(isPrivateOrLocalIp('203.0.113.10'), false)
  })

  it('isVpnCheckDisabled when E2E_MODE set', () => {
    const prev = process.env.E2E_MODE
    process.env.E2E_MODE = '1'
    assert.equal(isVpnCheckDisabled(), true)
    process.env.E2E_MODE = prev
  })
})
