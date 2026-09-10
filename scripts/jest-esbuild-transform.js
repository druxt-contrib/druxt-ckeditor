// A Jest transformer for .js files, standing in for esbuild-jest.
//
// esbuild-jest strips sourcesContent from the sourcemap it returns. That is
// fine for stack traces. It breaks v8 coverage. With no source text to check
// against, v8-to-istanbul cannot tell esbuild's injected CommonJS interop
// code from our own source. So it blames the nearest real line it can find.
// Keeping sourcesContent lets it leave that code out of the report.
//
// It has no jest.mock() hoisting, so jest.config.js only uses it for src/.
'use strict'

const { transformSync } = require('esbuild')

module.exports = {
  canInstrument: true,
  createTransformer() {
    return {
      process(sourceText, sourcePath) {
        const { code, map } = transformSync(sourceText, {
          loader: 'js',
          format: 'cjs',
          target: 'es2018',
          sourcemap: true,
          sourcesContent: true,
          sourcefile: sourcePath,
        })
        return { code, map: JSON.parse(map) }
      },
    }
  },
}
