// Turning Drupal's configured toolbar into one CKEditor can render.
//
// The filtering is the point: Drupal's toolbar vocabulary includes buttons from
// modules the classic build has no plugin for, and passing one through throws
// `toolbarview-item-unavailable` and takes the whole editor down. Getting this
// wrong loses the field, not just a button.

import assert from 'assert/strict'

import {
  ALIASES,
  FALLBACK_TOOLBAR,
  SUPPORTED,
  configuredToolbar,
  editorForFormat,
  toolbarFor,
  usableToolbar,
} from '../src/toolbar'

const editor = (format, items) => ({
  attributes: {
    drupal_internal__format: format,
    settings: { toolbar: { items } },
  },
})

// What a stock Drupal 11 basic_html actually reports.
const BASIC_HTML = [
  'bold',
  'italic',
  '|',
  'link',
  '|',
  'bulletedList',
  'numberedList',
  '|',
  'blockQuote',
  'drupalInsertImage',
  '|',
  'heading',
]

test('an editor is matched on the format machine name', () => {
  const all = [editor('basic_html', BASIC_HTML), editor('full_html', ['bold'])]
  // The field's value carries the machine name, never the resource id.
  assert.equal(
    editorForFormat(all, 'full_html').attributes.drupal_internal__format,
    'full_html'
  )
  assert.equal(editorForFormat(all, 'nope'), null)
  assert.equal(editorForFormat(null, 'basic_html'), null)
  assert.equal(editorForFormat([], null), null)
})

test('buttons this build cannot render are dropped', () => {
  const toolbar = toolbarFor([editor('basic_html', BASIC_HTML)], 'basic_html')
  assert.ok(!toolbar.includes('drupalInsertImage'))
  assert.ok(toolbar.includes('bold'))
  assert.ok(toolbar.includes('heading'))
})

test('separators left stranded by a dropped button are collapsed', () => {
  // `blockQuote drupalInsertImage |` would otherwise leave a doubled divider.
  const toolbar = toolbarFor([editor('basic_html', BASIC_HTML)], 'basic_html')
  assert.ok(!toolbar.some((item, i) => item === '|' && toolbar[i - 1] === '|'))
  assert.notEqual(toolbar[0], '|')
  assert.notEqual(toolbar[toolbar.length - 1], '|')
})

test('an unknown format falls back rather than rendering nothing', () => {
  assert.deepEqual(
    toolbarFor([editor('basic_html', BASIC_HTML)], 'restricted_html'),
    FALLBACK_TOOLBAR
  )
})

test('no configuration at all falls back', () => {
  // A site that has not ticked `editor--editor` in the resource list. The
  // read answers an empty collection rather than an error.
  assert.deepEqual(toolbarFor([], 'basic_html'), FALLBACK_TOOLBAR)
  assert.deepEqual(toolbarFor(null, 'basic_html'), FALLBACK_TOOLBAR)
})

test('a toolbar of only unsupported buttons falls back', () => {
  // Better a working editor with the wrong buttons than an empty toolbar.
  const only = [editor('basic_html', ['drupalMedia', 'drupalInsertVideo'])]
  assert.deepEqual(toolbarFor(only, 'basic_html'), FALLBACK_TOOLBAR)
})

test('a button with no plugin behind it is dropped', () => {
  // Passing CKEditor a button it has no plugin for throws and takes the editor
  // down, so it never reaches the toolbar.
  const configured = [editor('full_html', ['bold', 'drupalMedia', 'code'])]
  assert.deepEqual(toolbarFor(configured, 'full_html'), ['bold', 'code'])
})

test("Drupal's image button is renamed, not dropped", () => {
  // Drupal registers `drupalInsertImage`; the thing it does is CKEditor's
  // `uploadImage`. The site is configured to offer image insertion, so it is
  // offered, under the name the editor answers to.
  const configured = [editor('full_html', ['bold', 'drupalInsertImage'])]
  assert.deepEqual(toolbarFor(configured, 'full_html'), ['bold', 'uploadImage'])
})

test('the buttons the classic build lacked are offered now', () => {
  // The whole point of assembling the editor from DLL builds: every one of
  // these is configured on a site's full_html and used to be filtered out.
  const gained = [
    'code',
    'codeBlock',
    'strikethrough',
    'superscript',
    'subscript',
    'removeFormat',
    'horizontalLine',
    'sourceEditing',
  ]
  const toolbar = toolbarFor([editor('full_html', gained)], 'full_html')
  assert.deepEqual(toolbar, gained)
})

test('the build can supply a toolbar when Drupal will not', () => {
  // `editor--editor` is not ticked in the resource list, so the read answers
  // an empty collection. The committed configuration is what the editor gets
  // built from.
  const configured = [
    'bold',
    'italic',
    '|',
    'drupalInsertImage',
    'code',
    '|',
    'sourceEditing',
  ]
  assert.deepEqual(usableToolbar(configured), [
    'bold',
    'italic',
    '|',
    'uploadImage',
    'code',
    '|',
    'sourceEditing',
  ])
})

test('nothing configured is nothing usable, rather than a fallback', () => {
  // The caller decides what to do with nothing. `toolbarFor` substitutes the
  // fallback; this has to be able to say "Drupal offered nothing" so the
  // build's own copy gets its turn.
  assert.deepEqual(usableToolbar([]), [])
  assert.deepEqual(usableToolbar(null), [])
  assert.deepEqual(usableToolbar(['drupalMedia']), [])
})

test('the store answers with the configured items', async () => {
  const store = {
    dispatch: async (action, payload) => {
      assert.equal(action, 'druxt/getCollection')
      assert.deepEqual(payload, { type: 'editor--editor' })
      return {
        data: [
          {
            type: 'editor--editor',
            attributes: {
              drupal_internal__format: 'basic_html',
              settings: {
                toolbar: {
                  items: ['bold', '|', 'drupalInsertImage', 'notAButton'],
                },
              },
            },
          },
        ],
      }
    },
  }
  assert.deepEqual(await configuredToolbar(store, 'basic_html'), [
    'bold',
    '|',
    'uploadImage',
  ])
})

test('a store that cannot answer yields nothing, not the fallback', async () => {
  const store = {
    dispatch: async () => {
      throw new Error('403')
    },
  }
  assert.deepEqual(await configuredToolbar(store, 'basic_html'), [])
  const empty = { dispatch: async () => ({ data: [] }) }
  assert.deepEqual(await configuredToolbar(empty, 'basic_html'), [])
  const nothing = { dispatch: async () => null }
  assert.deepEqual(await configuredToolbar(nothing, 'basic_html'), [])
})

test('no store yields nothing', async () => {
  assert.deepEqual(await configuredToolbar(null, 'basic_html'), [])
})

test('SUPPORTED and ALIASES are the rules usableToolbar applies', () => {
  assert.ok(SUPPORTED.has('bold'))
  assert.ok(SUPPORTED.has('|'))
  assert.ok(!SUPPORTED.has('drupalInsertImage'))
  assert.equal(ALIASES.drupalInsertImage, 'uploadImage')
})
