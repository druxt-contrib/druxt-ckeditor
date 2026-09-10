import assert from 'assert/strict'

import {
  DRUPAL_FILES,
  editorFileUrls,
  isDrupalFile,
  rewriteFileUrls,
  storedFileUrls,
} from '../src/files'

test('a stored path is rewritten to wherever the site serves the file', () => {
  assert.equal(
    rewriteFileUrls(
      '<img src="/sites/default/files/inline-images/a.png" alt="x">',
      { from: DRUPAL_FILES, to: '/files/' }
    ),
    '<img src="/files/inline-images/a.png" alt="x">'
  )
})

test('single quotes are rewritten too', () => {
  // What is in the field is whatever the editor wrote, and Drupal's own filters
  // are not consistent about which quote they use.
  assert.equal(
    rewriteFileUrls("<img src='/sites/default/files/a.png'>", {
      from: DRUPAL_FILES,
      to: '/files/',
    }),
    "<img src='/files/a.png'>"
  )
})

test("another site's image is left alone", () => {
  // An absolute URL that happens to contain Drupal's files path is somebody
  // linking to a different site, and rewriting it would break the link.
  const html = '<img src="https://example.test/sites/default/files/a.png">'
  assert.equal(
    rewriteFileUrls(html, { from: DRUPAL_FILES, to: '/files/' }),
    html
  )
})

test('a field with no markup is not a special case', () => {
  assert.equal(rewriteFileUrls('', { from: DRUPAL_FILES, to: '/files/' }), '')
  assert.equal(
    rewriteFileUrls(undefined, { from: DRUPAL_FILES, to: '/files/' }),
    undefined
  )
  assert.equal(
    rewriteFileUrls('<p>No pictures here.</p>', {
      from: DRUPAL_FILES,
      to: '/files/',
    }),
    '<p>No pictures here.</p>'
  )
})

test('a rewrite with nowhere to go is a no-op', () => {
  const html = '<img src="/sites/default/files/a.png">'
  assert.equal(rewriteFileUrls(html, { from: DRUPAL_FILES, to: null }), html)
  assert.equal(
    rewriteFileUrls(html, { from: DRUPAL_FILES, to: DRUPAL_FILES }),
    html
  )
})

test('the path being rewritten is the one Drupal serves from', () => {
  assert.equal(DRUPAL_FILES, '/sites/default/files/')
  assert.equal(isDrupalFile('/sites/default/files/x.png'), true)
  assert.equal(isDrupalFile('/images/x.png'), false)
  assert.equal(isDrupalFile(undefined), false)
  assert.equal(isDrupalFile('/media/x.png', '/media/'), true)
})

test('a body image is addressed at the backend for the editor', () => {
  // The editable shows stored markup as-is, and the frontend does not serve
  // Drupal's files path, so every image would be a broken picture.
  const html = '<p><img src="/sites/default/files/inline-images/a.png"></p>'
  assert.equal(
    editorFileUrls(html, {
      from: DRUPAL_FILES,
      to: null,
      backendUrl: 'https://backend.test',
    }),
    '<p><img src="https://backend.test/sites/default/files/inline-images/a.png"></p>'
  )
})

test('and put back before it is stored', () => {
  // An absolute URL here would bake this session's backend into the content,
  // and that backend stops existing.
  const html =
    '<p><img src="https://backend.test/sites/default/files/inline-images/a.png"></p>'
  assert.equal(
    storedFileUrls(html, {
      from: DRUPAL_FILES,
      to: null,
      backendUrl: 'https://backend.test/',
    }),
    '<p><img src="/sites/default/files/inline-images/a.png"></p>'
  )
})

test("the site's own copy wins over the backend on the way in", () => {
  const html = '<p><img src="/sites/default/files/a.png"></p>'
  assert.equal(
    editorFileUrls(html, {
      from: DRUPAL_FILES,
      to: '/files/',
      backendUrl: 'https://backend.test',
    }),
    '<p><img src="/files/a.png"></p>'
  )
})

test('both forms fold back to the stored path on the way out', () => {
  // An image the author already had came from the site's copy; one they just
  // uploaded came back from the backend as an absolute URL.
  const html =
    '<p><img src="/files/a.png"><img src="https://backend.test/sites/default/files/b.png"></p>'
  assert.equal(
    storedFileUrls(html, {
      from: DRUPAL_FILES,
      to: '/files/',
      backendUrl: 'https://backend.test',
    }),
    '<p><img src="/sites/default/files/a.png"><img src="/sites/default/files/b.png"></p>'
  )
})

test('with no backend and no copy, the markup is left alone', () => {
  const html = '<p><img src="/sites/default/files/a.png"></p>'
  assert.equal(
    editorFileUrls(html, { from: DRUPAL_FILES, to: null, backendUrl: null }),
    html
  )
  assert.equal(
    storedFileUrls(html, { from: DRUPAL_FILES, to: null, backendUrl: '' }),
    html
  )
  assert.equal(editorFileUrls(html), html)
  assert.equal(storedFileUrls(html), html)
})

test('a link to another site is not touched', () => {
  const html =
    '<p><img src="https://example.test/sites/default/files/a.png"></p>'
  assert.equal(
    storedFileUrls(html, {
      from: DRUPAL_FILES,
      to: null,
      backendUrl: 'https://backend.test',
    }),
    html
  )
})
