await Bun.build({
  entrypoints: ['src/index.ts'],
  // Minifying identifiers also dodges a Bun 1.4.1 renamer bug that emits invalid
  // JS for Elysia (oven-sh/bun#41351).
  minify: {
    whitespace: true,
    syntax: true,
    identifiers: true,
  },
  sourcemap: 'inline', // keeps source file and line in stack traces despite minified names
  target: 'bun',
  compile: {
    outfile: 'server',
  },
  external: ['@valibot/to-json-schema', 'sury', 'effect'], // Modules to exclude from the bundle
})
