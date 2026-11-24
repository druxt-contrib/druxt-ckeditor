import assert from 'assert/strict'

import { withoutTrailingSlash } from '../src/url'

test('a URL with no trailing slash is returned as it is', () => {
  assert.equal(
    withoutTrailingSlash('https://example.com/drupal'),
    'https://example.com/drupal'
  )
})

test('one trailing slash is removed, and so is a run of them', () => {
  assert.equal(
    withoutTrailingSlash('https://example.com/'),
    'https://example.com'
  )
  assert.equal(
    withoutTrailingSlash('https://example.com///'),
    'https://example.com'
  )
})

test('a value that is nothing but slashes comes back empty', () => {
  // The walk has to stop at the start of the string rather than read past it.
  assert.equal(withoutTrailingSlash('///'), '')
  assert.equal(withoutTrailingSlash(''), '')
})

test('a value that is not a string is read as one', () => {
  // `backendUrl` is whatever the site configured, and the callers pass it
  // through unchecked.
  assert.equal(withoutTrailingSlash(undefined), 'undefined')
})
