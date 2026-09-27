// Putting a file into Drupal over JSON:API.
//
// The file does not go as a JSON:API document: it goes to the field's own route
// as raw bytes with the filename in a header. Everything below was established
// against a running Drupal rather than taken from the documentation.

import assert from 'assert/strict'

import { safeFilename, uploadHeaders, uploadUrl } from '../src/upload'

test('the bytes go to the field, not to the file collection', () => {
  assert.equal(
    uploadUrl('node--article', 'field_image'),
    '/jsonapi/node/article/field_image'
  )
})

test('the url is relative, so it rides the Druxt client to its own backend', () => {
  assert.ok(uploadUrl('node--article', 'field_image').startsWith('/jsonapi/'))
})

test('the request is bytes, not a document, and sets no Authorization itself', () => {
  const headers = uploadHeaders('photo.png')
  // JSON:API's own media type here is a 415.
  assert.equal(headers['Content-Type'], 'application/octet-stream')
  assert.equal(headers['Content-Disposition'], 'file; filename="photo.png"')
  assert.equal(headers.Accept, 'application/vnd.api+json')
  // The Druxt client's axios adds the bearer token, not this.
  assert.equal(headers.Authorization, undefined)
})

test('a filename cannot break out of its header', () => {
  // Content-Disposition is a header: a newline is request smuggling and a quote
  // ends the value early.
  assert.equal(safeFilename('a"b\nc.png'), 'abc.png')
  assert.equal(safeFilename('../../etc/passwd'), 'passwd')
  assert.equal(safeFilename(''), 'upload')
  assert.equal(safeFilename(null), 'upload')
})
