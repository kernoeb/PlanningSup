import { describe, expect, it } from 'bun:test'
import { getClientIp, isCloudflareIp, parseIp } from '@api/utils/client-ip'

function request(headers: Record<string, string>) {
  return new Request('http://local/api/ics', { headers })
}

describe('isCloudflareIp', () => {
  it('matches IPv4, IPv6 and IPv4-mapped addresses', () => {
    expect(isCloudflareIp('104.21.24.68')).toBeTrue()
    expect(isCloudflareIp('172.67.217.89')).toBeTrue()
    expect(isCloudflareIp('::ffff:162.158.1.1')).toBeTrue()
    expect(isCloudflareIp('2a06:98c7:ffff::1')).toBeTrue()
    expect(isCloudflareIp('2606:4700::6810:1844')).toBeTrue()
  })

  it('rejects other and invalid addresses', () => {
    expect(isCloudflareIp('91.98.171.40')).toBeFalse()
    expect(isCloudflareIp('104.15.255.255')).toBeFalse()
    expect(isCloudflareIp('2a06:98d0::1')).toBeFalse()
    expect(isCloudflareIp('not-an-ip')).toBeFalse()
    expect(parseIp('1.2.3.256')).toBeNull()
    expect(parseIp('1::2::3')).toBeNull()
  })
})

describe('getClientIp', () => {
  it('uses CF-Connecting-IP when the peer is Cloudflare', () => {
    expect(getClientIp(request({ 'x-forwarded-for': '162.158.1.1', 'cf-connecting-ip': '203.0.113.7' }), '10.0.1.5')).toBe('203.0.113.7')
  })

  it('ignores CF-Connecting-IP from a direct client', () => {
    expect(getClientIp(request({ 'x-forwarded-for': '198.51.100.9', 'cf-connecting-ip': '203.0.113.7' }), '10.0.1.5')).toBe('198.51.100.9')
  })

  it('uses the last X-Forwarded-For entry, which the proxy wrote', () => {
    expect(getClientIp(request({ 'x-forwarded-for': '1.1.1.1, 198.51.100.9' }), undefined)).toBe('198.51.100.9')
  })

  it('falls back to the socket address', () => {
    expect(getClientIp(request({}), '198.51.100.9')).toBe('198.51.100.9')
    expect(getClientIp(request({}), undefined)).toBe('unknown')
  })
})
