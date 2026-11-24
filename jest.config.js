module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{js,vue}'],
  coverageDirectory: './coverage/',
  // The babel provider cannot instrument a component that has both a
  // <template> and a <script> block. vue-jest's source map covers the script
  // half only. The render function's branches are dropped and the whole file
  // counts as one covered statement. v8 reads coverage from the engine and
  // does not need that source map.
  coverageProvider: 'v8',
  // A floor, not a target. These are the measured baseline of this template's
  // own tests, rounded down: raise them as coverage genuinely improves, and
  // never lower them to make a merge request pass. Collecting coverage without
  // a threshold is the shape this replaces, and it enforces nothing while
  // looking like it does.
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 94,
      functions: 100,
      lines: 100,
    },
  },
  coveragePathIgnorePatterns: ['/dist/', '/node_modules/'],
  moduleFileExtensions: ['js', 'json', 'vue'],
  // The component imports the package by name, the way it does from
  // dist/components/ once published. Jest reads the source instead.
  moduleNameMapper: {
    '^@druxt-contrib/ckeditor$': '<rootDir>/src/index.js',
  },
  modulePathIgnorePatterns: ['/example/'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['/example/', '/test/e2e/'],
  transform: {
    // Files under src/ are the ones coverage is collected from. esbuild-jest
    // drops the sourcemap's sourcesContent. That leaves v8 coverage blaming
    // real lines for bundler-injected code. So src/ goes through the local
    // transformer. See scripts/jest-esbuild-transform.js.
    '^.+/src/.+\\.js$': '<rootDir>/scripts/jest-esbuild-transform.js',
    // Everything else, the tests included, stays on esbuild-jest. It runs
    // babel first when a file calls jest.mock(), which hoists the mock above
    // the imports. The local transformer does not.
    '^.+\\.js$': 'esbuild-jest',
    '^.+\\.(mjs)$': 'esbuild-jest',
    '^.+\\.(vue)$': 'vue-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!(druxt)/)'],
}
