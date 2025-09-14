declare module '*.css';
declare module '@fontsource/*' {}
declare module '@fontsource-variable/*' {}

declare global {
  // eslint-disable-next-line vars-on-top
  var __APP_CONFIG__: {
    authEnabled: boolean
  } | undefined
}

export {}
