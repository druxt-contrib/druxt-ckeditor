import assert from 'assert/strict'

import {
  captionsAreAttributes,
  decodeAttribute,
  encodeAttribute,
  fromEditorCaptions,
  toEditorCaptions,
} from '../src/captions'

test('an ampersand is decoded once, not twice', () => {
  assert.equal(decodeAttribute('a &amp;lt;b&amp;gt; c'), 'a &lt;b&gt; c')
})

test('a stored caption survives repeated trips through the editor unchanged', () => {
  // Not merely readable afterwards: identical. The field compares what comes
  // out of the editor with what went in to decide whether anything changed, so
  // a value that never comes back the same is a value that reports an edit
  // nobody made, and re-encodes itself a little more each time.
  const stored =
    '<p>text</p>\n<img src="/sites/default/files/a.png" alt="x" ' +
    'data-entity-type="file" data-entity-uuid="u" data-caption="Drupal\'s layout &amp; more.">'
  let value = stored
  for (let i = 0; i < 3; i += 1)
    value = fromEditorCaptions(toEditorCaptions(value))
  assert.equal(value, stored)
})

test('encodeAttribute is the inverse of decodeAttribute', () => {
  const text = 'Drupal\'s <em>rules</em> & "quotes"'
  assert.equal(decodeAttribute(encodeAttribute(text)), text)
})

test('an apostrophe written as a hex reference decodes like a decimal one', () => {
  // Both forms appear in the wild. Handling only `&#39;` meant `&#x27;` kept
  // its ampersand re-encoded on every save.
  assert.equal(decodeAttribute('Drupal&#x27;s'), "Drupal's")
  assert.equal(decodeAttribute('Drupal&#39;s'), "Drupal's")
})

test('a figure with no caption is left as the editor wrote it', () => {
  const figure =
    '<figure class="image"><img src="/a.png"><figcaption></figcaption></figure>'
  assert.equal(fromEditorCaptions(figure), figure)
})

test('captions are attributes only where Drupal will build the figure back', () => {
  const filters = {
    full_html: ['editor_file_reference', 'filter_caption', 'filter_align'],
    plain_html: ['filter_autop', 'filter_url'],
  }
  assert.equal(captionsAreAttributes(filters, 'full_html'), true)
  assert.equal(captionsAreAttributes(filters, 'plain_html'), false)
})

test('a format nobody could look up is assumed to run the filter', () => {
  // Every format shipping with Drupal that permits images runs it, and the
  // other default would quietly change how existing content is stored the
  // first time a lookup failed.
  assert.equal(captionsAreAttributes({}, 'unknown'), true)
  assert.equal(captionsAreAttributes(null, 'unknown'), true)
})
