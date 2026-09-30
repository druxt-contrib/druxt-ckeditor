/**
 * Content images, addressed for the editor and for Drupal.
 *
 * An image inserted into a body field through CKEditor is a Drupal file, and
 * Drupal writes its own URL into the markup: `/sites/default/files/...`. That
 * URL is served by Drupal, not by the frontend. Inside the editor it has to
 * point somewhere the browser can fetch, and on the way back out it has to
 * be what Drupal stores. Pure, so the rewriting is testable without an editor.
 */

/** Where Drupal serves public files from. */
export const DRUPAL_FILES = '/sites/default/files/'

/**
 * Point markup at another copy of the same files.
 *
 * Only quoted attribute values starting with `from` are touched. An absolute
 * URL to somewhere else is somebody linking to another site's image, and
 * rewriting that would break it. Both quote styles, because what is in the
 * field is whatever the editor wrote, and Drupal's own filters are not
 * consistent about it.
 */
export function rewriteFileUrls(html, { from, to } = {}) {
  if (!html || !from || !to || from === to) return html
  return String(html)
    .split(`"${from}`)
    .join(`"${to}`)
    .split(`'${from}`)
    .join(`'${to}`)
}

/** Whether a path is one of Drupal's public files. */
export function isDrupalFile(url, from = DRUPAL_FILES) {
  return String(url || '').includes(from)
}

/** A backend's origin with no trailing slash, or null. */
function origin(backendUrl) {
  return backendUrl ? String(backendUrl).replace(/\/+$/, '') : null
}

/**
 * A body image, addressed so the editor can show it.
 *
 * `to` is where the site serves its own copy of the files, when it has one.
 * Without it, the backend serves the originals, so the path is made absolute
 * against `backendUrl`. With neither, the markup is left alone: the picture
 * is broken in the editor, but the markup is not changed.
 */
export function editorFileUrls(
  html,
  { from = DRUPAL_FILES, to = null, backendUrl = null } = {}
) {
  const base = origin(backendUrl)
  const target = to || (base ? `${base}${from}` : null)
  return rewriteFileUrls(html, { from, to: target })
}

/**
 * And back to what Drupal stores, whichever copy the editor was shown.
 *
 * Both forms fold back: the site's copy, for images the author already had,
 * and the backend's absolute URL, for ones just uploaded. An absolute URL in
 * stored content would bake one backend's address into it.
 */
export function storedFileUrls(
  html,
  { from = DRUPAL_FILES, to = null, backendUrl = null } = {}
) {
  const base = origin(backendUrl)
  let out = html
  if (base) out = rewriteFileUrls(out, { from: `${base}${from}`, to: from })
  if (to) out = rewriteFileUrls(out, { from: to, to: from })
  return out
}
