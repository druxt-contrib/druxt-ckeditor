/**
 * Putting a file into Drupal over JSON:API.
 *
 * Not a JSON:API document at all. The file goes to the field's own upload
 * route as raw bytes, with the filename in a `Content-Disposition` header,
 * and comes back as a `file--file` resource. Attaching that resource to an
 * entity is a second, ordinary request, and not this module's job.
 *
 * An uploaded file is temporary. It has `status: false` until something
 * references it, and Drupal's cron deletes unreferenced temporary files. An
 * upload that is never attached is not a leak. It is rubbish that clears
 * itself, but it is also not saved.
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
