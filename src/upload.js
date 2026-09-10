/**
 * Putting a file into Drupal over JSON:API.
 *
 * Not a JSON:API document at all: the file goes to the field's own upload route
 * as raw bytes, with the filename in a `Content-Disposition` header, and comes
 * back as a `file--file` resource. Attaching that resource to an entity is a
 * second, ordinary request.
 *
 * Three things about it are worth knowing before reading the code, all of them
 * established against a running Drupal rather than from the documentation.
 *
 * An uploaded file is **temporary**. It has `status: false` until something
 * references it, and Drupal's cron deletes unreferenced temporary files. An
 * upload that is never attached is not a leak, it is rubbish that clears itself,
 * but it is also not saved.
 *
 * The relationship carries the alt text in its `meta`, and **a relationship sent
 * without `meta` silently clears it**: Drupal answers 200 and the alt becomes
 * null. The field is configured to require alt text, and JSON:API does not
 * enforce that, so nothing complains. Any request that sends the relationship
 * has to send the meta with it.
 *
 * A new entity may carry the image in the same request that creates it, so
 * content invented in the browser does not need a second round trip.
 */

/** Where the bytes go: the field's own route, not the file collection. */
export function uploadUrl(backendUrl, resourceType, field) {
  const [entityType, bundle] = String(resourceType).split('--')
  const path = bundle ? `${entityType}/${bundle}` : entityType
  return `${String(backendUrl).replace(/\/+$/, '')}/jsonapi/${path}/${field}`
}

/**
 * A filename Drupal will accept in a header.
 *
 * `Content-Disposition` is a header, so a newline in a filename is a request
 * smuggling attempt and a quote ends the value early. Drupal sanitises the name
 * again on its side; this is about forming a valid request at all.
 */
export function safeFilename(name) {
  const cleaned = String(name || 'upload')
    .replace(/[\r\n]/g, '')
    .replace(/["\\]/g, '')
    .split(/[/\\]/)
    .pop()
    .trim()
  return cleaned || 'upload'
}

export function uploadHeaders(filename, token) {
  return {
    // Not the JSON:API media type: this request is the bytes themselves.
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `file; filename="${safeFilename(filename)}"`,
    Accept: 'application/vnd.api+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}
