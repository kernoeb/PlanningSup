declare global {
  // eslint-disable-next-line vars-on-top
  var __APP_CONFIG__: {
    authEnabled: boolean
    openpanelClientId?: string
  } | undefined
}

export {}
