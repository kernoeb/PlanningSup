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
    // Set by the Dockerfile to cross-compile. Bun rejects an explicit undefined target.
    ...(Bun.env.BUN_COMPILE_TARGET && { target: Bun.env.BUN_COMPILE_TARGET as Bun.Build.CompileTarget }),
  },
  external: ['@valibot/to-json-schema', 'sury', 'effect'], // Modules to exclude from the bundle
})
