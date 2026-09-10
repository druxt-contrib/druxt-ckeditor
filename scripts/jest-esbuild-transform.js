// A Jest transformer for .js files, standing in for esbuild-jest.
//
// esbuild-jest always strips sourcesContent from the sourcemap it returns,
// which is fine for stack traces but breaks v8 coverage: with no source text
// to check against, v8-to-istanbul cannot tell that a byte range belongs to
// esbuild's injected CommonJS interop code rather than our own source, and
// blames the nearest real line it can find instead. Keeping sourcesContent
// gives it what it needs to leave that code out of the report.
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
