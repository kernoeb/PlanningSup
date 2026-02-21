declare global {
  // eslint-disable-next-line vars-on-top
  var __APP_CONFIG__: {
    authEnabled: boolean
    plausible?: {
      domain?: string
      endpoint?: string
    }
    donationLinks?: {
      name: string
      url: string
    }[]
  } | undefined
}

export {}
