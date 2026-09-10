// Putting a file into Drupal over JSON:API.
//
// The file does not go as a JSON:API document: it goes to the field's own route
// as raw bytes with the filename in a header. Everything below was established
// against a running Drupal rather than taken from the documentation.

import assert from 'assert/strict'

import { safeFilename, uploadHeaders, uploadUrl } from '../src/upload'

test('the bytes go to the field, not to the file collection', () => {
  assert.equal(
    uploadUrl('https://b.test', 'node--article', 'field_image'),
    'https://b.test/jsonapi/node/article/field_image'
  )
})

test('a trailing slash on the backend does not double up', () => {
  assert.ok(
    uploadUrl('https://b.test/', 'node--article', 'field_image').startsWith(
      'https://b.test/jsonapi/'
    )
  )
})

test('the request is bytes, not a document', () => {
  const headers = uploadHeaders('photo.png', 'tok')
  // JSON:API's own media type here is a 415.
  assert.equal(headers['Content-Type'], 'application/octet-stream')
  assert.equal(headers['Content-Disposition'], 'file; filename="photo.png"')
  assert.equal(headers.Authorization, 'Bearer tok')
})

test('a filename cannot break out of its header', () => {
  // Content-Disposition is a header: a newline is request smuggling and a quote
  // ends the value early.
  assert.equal(safeFilename('a"b\nc.png'), 'abc.png')
  assert.equal(safeFilename('../../etc/passwd'), 'passwd')
  assert.equal(safeFilename(''), 'upload')
  assert.equal(safeFilename(null), 'upload')
})
