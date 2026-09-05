await Bun.build({
  entrypoints: ['src/index.ts'],
  minify: {
    whitespace: true,
    syntax: true,
    identifiers: true,
  },
  sourcemap: 'inline', // minified names alone would make stack traces unreadable
  target: 'bun',
  compile: {
    outfile: 'server',
  },
  external: ['@valibot/to-json-schema', 'sury', 'effect'], // Modules to exclude from the bundle
})
