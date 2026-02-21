export interface DonationLink { name: string, url: string }

export const DONATION_LINKS: readonly DonationLink[] = globalThis.__APP_CONFIG__?.donationLinks ?? []

export const BRAND_COLORS: Record<string, { bg: string, text: string }> = {
  'PayPal': { bg: '#003087', text: '#ffffff' },
  'Ko-fi': { bg: '#FF5E5B', text: '#ffffff' },
  'Buy Me a Coffee': { bg: '#FFDD00', text: '#000000' },
}
