await Bun.build({
  entrypoints: ['src/index.ts'],
  minify: {
    whitespace: true,
    syntax: true,
    identifiers: false,
  },
  target: 'bun',
  compile: {
    outfile: 'server',
  },
  external: ['@valibot/to-json-schema', 'sury', 'effect'], // Modules to exclude from the bundle
})
