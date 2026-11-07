// https://www.cloudflare.com/ips/ (checked 28 September 2026)
const CLOUDFLARE_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
]

interface ParsedIp { value: bigint, bits: 32 | 128 }

function parseIpv4(ip: string): bigint | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let value = 0n
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null
    value = (value << 8n) | BigInt(part)
  }
  return value
}

function parseIpv6(ip: string): bigint | null {
  const halves = ip.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null

  let value = 0n
  for (const group of [...head, ...Array.from<string>({ length: missing }).fill('0'), ...tail]) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null
    value = (value << 16n) | BigInt(`0x${group}`)
  }
  return value
}

export function parseIp(raw: string): ParsedIp | null {
  // Dual-stack sockets report IPv4 clients as ::ffff:1.2.3.4
  const ip = raw.trim().replace(/^::ffff:(?=\d+\.)/i, '')
  const v4 = parseIpv4(ip)
  if (v4 !== null) return { value: v4, bits: 32 }
  const v6 = parseIpv6(ip)
  return v6 === null ? null : { value: v6, bits: 128 }
}

const cloudflareRanges = CLOUDFLARE_RANGES.map((cidr) => {
  const [ip, prefix] = cidr.split('/') as [string, string]
  const parsed = parseIp(ip)!
  const shift = BigInt(parsed.bits - Number(prefix))
  return { bits: parsed.bits, shift, network: parsed.value >> shift }
})

export function isCloudflareIp(ip: string) {
  const parsed = parseIp(ip)
  if (!parsed) return false
  return cloudflareRanges.some(r => r.bits === parsed.bits && parsed.value >> r.shift === r.network)
}

/**
 * Best guess of the client IP, for rate limiting.
 * The API runs behind Traefik, which replaces X-Forwarded-For with the address it sees,
 * so the last entry is the real peer. CF-Connecting-IP is only trusted when that peer is Cloudflare.
 */
export function getClientIp(request: Request, socketAddress: string | undefined) {
  const peer = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || socketAddress || 'unknown'
  const cfClient = request.headers.get('cf-connecting-ip')?.trim()
  if (cfClient && isCloudflareIp(peer)) return cfClient
  return peer
}
