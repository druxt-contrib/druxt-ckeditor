import assert from 'assert/strict'

import {
  CORE,
  BUTTON_PLUGINS,
  DEFAULT_PACKAGES,
  SUPPORTED_BUTTONS,
  editorPlugins,
  loadCkeditor,
  loadScript,
  resetLoader,
  resolvePlugins,
  scriptUrl,
} from '../src/loader'

/**
 * A document whose scripts settle on the next microtask.
 *
 * `fail` names scripts whose `onerror` fires, `hang` names scripts that never
 * settle at all, which is what a firewalled host looks like from a browser.
 */
function fakeDocument({ fail = [], hang = [] } = {}) {
  const scripts = []
  const document = {
    head: {
      appendChild(script) {
        scripts.push(script)
        queueMicrotask(() => {
          if (hang.some((name) => script.src.includes(name))) return
          if (fail.some((name) => script.src.includes(name))) {
            if (typeof script.onerror === 'function') script.onerror()
          } else if (typeof script.onload === 'function') {
            script.onload()
          }
        })
      },
    },
    createElement() {
      return { src: '', async: true, onload: null, onerror: null }
    },
  }
  return { document, scripts }
}

beforeEach(() => resetLoader())

test('a script URL follows the layout Drupal serves', () => {
  assert.equal(
    scriptUrl(
      'https://drupal.example.com/core/assets/vendor/ckeditor5/',
      'table'
    ),
    'https://drupal.example.com/core/assets/vendor/ckeditor5/table/table.js'
  )
  assert.equal(
    scriptUrl('/ckeditor5', CORE),
    '/ckeditor5/ckeditor5-dll/ckeditor5-dll.js'
  )
})

test('a script is requested once for the life of the page', async () => {
  const { document, scripts } = fakeDocument()
  const first = loadScript('/a/a.js', { document })
  const second = loadScript('/a/a.js', { document })
  assert.equal(first, second)
  await first
  assert.equal(scripts.length, 1)
  assert.equal(scripts[0].async, false)
})

test('a script that does not load rejects with its URL', async () => {
  const { document } = fakeDocument({ fail: ['broken'] })
  await assert.rejects(
    loadScript('/broken/broken.js', { document }),
    /Could not load \/broken\/broken.js/
  )
})

test('a script that never settles times out', async () => {
  const { document } = fakeDocument({ hang: ['slow'] })
  await assert.rejects(
    loadScript('/slow/slow.js', { document, timeout: 5 }),
    /Timed out loading \/slow\/slow.js/
  )
})

test('a failed script can be tried again', async () => {
  const { document, scripts } = fakeDocument({ fail: ['flaky'] })
  await assert.rejects(loadScript('/flaky/flaky.js', { document }))
  const again = fakeDocument()
  await loadScript('/flaky/flaky.js', { document: again.document })
  assert.equal(scripts.length, 1)
  assert.equal(again.scripts.length, 1)
})

test('the core build is awaited before the packages', async () => {
  const { document, scripts } = fakeDocument()
  const window = { CKEditor5: { editorClassic: {} } }
  const loading = loadCkeditor({
    base: '/ckeditor5',
    packages: ['a', 'b', 'c'],
    document,
    window,
  })
  assert.equal(scripts.length, 1)
  assert.equal(scripts[0].src, '/ckeditor5/ckeditor5-dll/ckeditor5-dll.js')
  const namespace = await loading
  assert.equal(namespace, window.CKEditor5)
  assert.deepEqual(
    scripts.map((script) => script.src),
    [
      '/ckeditor5/ckeditor5-dll/ckeditor5-dll.js',
      '/ckeditor5/a/a.js',
      '/ckeditor5/b/b.js',
      '/ckeditor5/c/c.js',
    ]
  )
})

test('the default package list is the one Drupal ships', async () => {
  const { document, scripts } = fakeDocument()
  await loadCkeditor({ base: '/x', document, window: { CKEditor5: {} } })
  assert.equal(scripts.length, DEFAULT_PACKAGES.length + 1)
  assert.equal(DEFAULT_PACKAGES.length, 16)
})

test('a trailing slash on the base is not doubled', async () => {
  const { document, scripts } = fakeDocument()
  await loadCkeditor({
    base: 'https://cdn.example.net/ckeditor5/',
    packages: ['a'],
    document,
    window: { CKEditor5: {} },
  })
  assert.equal(scripts[1].src, 'https://cdn.example.net/ckeditor5/a/a.js')
})

test('no base is an error, not a request', async () => {
  const { document, scripts } = fakeDocument()
  await assert.rejects(
    loadCkeditor({ base: null, document, window: {} }),
    /No base URL/
  )
  assert.equal(scripts.length, 0)
})

test('no document is an error', async () => {
  await assert.rejects(
    loadCkeditor({ base: '/x', document: null, window: {} }),
    /needs a document/
  )
})

test('scripts that load but define nothing are an error', async () => {
  const { document } = fakeDocument()
  await assert.rejects(
    loadCkeditor({ base: '/x', packages: [], document, window: {} }),
    /defined no CKEditor5 namespace/
  )
})

test('a package that fails takes the load down with it', async () => {
  const { document } = fakeDocument({ fail: ['/table/'] })
  await assert.rejects(
    loadCkeditor({
      base: '/x',
      packages: ['table'],
      document,
      window: { CKEditor5: {} },
    }),
    /table\/table.js/
  )
})

test('plugins resolve by namespace and export, once each', () => {
  const Bold = class {}
  const List = class {}
  const namespace = { basicStyles: { Bold }, list: { List } }
  assert.deepEqual(
    resolvePlugins(namespace, [
      'basicStyles.Bold',
      'list.List',
      'list.List',
      'table.Table',
    ]),
    [Bold, List]
  )
  assert.deepEqual(resolvePlugins(null, ['basicStyles.Bold']), [])
})

test('the editor gets every plugin that loaded', () => {
  const Essentials = class {}
  const Image = class {}
  const plugins = editorPlugins({
    essentials: { Essentials },
    image: { Image },
  })
  assert.deepEqual(plugins, [Essentials, Image])
})

test('the supported buttons are the keys of the plugin map', () => {
  assert.deepEqual(SUPPORTED_BUTTONS, Object.keys(BUTTON_PLUGINS))
  assert.ok(SUPPORTED_BUTTONS.includes('uploadImage'))
  assert.ok(SUPPORTED_BUTTONS.includes('sourceEditing'))
  assert.ok(!SUPPORTED_BUTTONS.includes('|'))
})
