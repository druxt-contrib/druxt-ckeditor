import assert from 'assert/strict'

import { createCkeditor, SCRIPTS_PATH } from '../src/plugin'
import { DEFAULTS } from '../src/index'
import * as loader from '../src/loader'

// esbuild's CommonJS output defines every named export as a non-configurable
// getter, so jest.spyOn cannot replace loadCkeditor on the real module.
// Mocking the module keeps every other export real and only replaces the one
// function under test.
jest.mock('../src/loader', () => ({
  ...jest.requireActual('../src/loader'),
  loadCkeditor: jest.fn(),
}))

/** A Druxt client the way the app carries it. */
function context(baseUrl, where = 'app') {
  const $druxt = { options: { baseUrl } }
  return where === 'app' ? { app: { $druxt } } : { $druxt }
}

test('the defaults derive from the Druxt base URL', () => {
  const plugin = createCkeditor(DEFAULTS, context('https://drupal.example.com'))
  assert.equal(plugin.backendUrl(), 'https://drupal.example.com')
  assert.equal(plugin.scripts(), `https://drupal.example.com${SCRIPTS_PATH}`)
  assert.deepEqual(plugin.files(), {
    from: '/sites/default/files/',
    to: 'https://drupal.example.com/sites/default/files/',
  })
  assert.equal(plugin.options, DEFAULTS)
})

test('a trailing slash on the base URL does not double up', () => {
  const plugin = createCkeditor(
    DEFAULTS,
    context('https://drupal.example.com/', 'root')
  )
  assert.equal(
    plugin.scripts(),
    'https://drupal.example.com/core/assets/vendor/ckeditor5'
  )
})

test('a repointed client is followed', () => {
  const ctx = context('https://one.example.com')
  const plugin = createCkeditor(DEFAULTS, ctx)
  assert.equal(
    plugin.scripts(),
    'https://one.example.com/core/assets/vendor/ckeditor5'
  )
  ctx.app.$druxt.options.baseUrl = 'https://two.example.com'
  assert.equal(
    plugin.scripts(),
    'https://two.example.com/core/assets/vendor/ckeditor5'
  )
})

test('an explicit URL on another host wins', () => {
  const options = {
    ...DEFAULTS,
    scripts: 'https://cdn.example.net/ckeditor5',
    files: { from: '/sites/default/files/', to: '/files/' },
  }
  const plugin = createCkeditor(options, context('https://drupal.example.com'))
  assert.equal(plugin.scripts(), 'https://cdn.example.net/ckeditor5')
  assert.deepEqual(plugin.files(), {
    from: '/sites/default/files/',
    to: '/files/',
  })
})

test('with no client there is nowhere to load from', () => {
  const plugin = createCkeditor(DEFAULTS, {})
  assert.equal(plugin.backendUrl(), null)
  assert.equal(plugin.scripts(), null)
  assert.deepEqual(plugin.files(), { from: '/sites/default/files/', to: null })
})

test('load() hands the loader the resolved base and never rejects', async () => {
  const calls = []
  loader.loadCkeditor.mockImplementation(async (args) => {
    calls.push(args)
    if (!args.base) throw new Error('No base URL to load CKEditor from.')
    return { editorClassic: {} }
  })
  const options = { ...DEFAULTS, packages: ['link'], timeout: 5 }
  const found = await createCkeditor(
    options,
    context('https://drupal.example.com')
  ).load()
  assert.deepEqual(found, { editorClassic: {} })
  assert.deepEqual(calls[0], {
    base: 'https://drupal.example.com/core/assets/vendor/ckeditor5',
    packages: ['link'],
    timeout: 5,
  })
  assert.equal(await createCkeditor(options, {}).load(), null)
  loader.loadCkeditor.mockRestore()
})
