/**
 * URL shapes shared by the parts of this module that address Drupal.
 *
 * The backend's origin arrives from `nuxt.config.js`, from Druxt's own
 * options and from Drupal's responses, and any of the three may or may not
 * end in a slash. Four places needed the same answer and each had its own
 * copy of the same expression.
 */

/**
 * The same value with any trailing slashes removed.
 *
 * Walked backwards rather than written as `replace(/\/+$/, '')`. A run
 * anchored to the end of a string can be entered at every offset before it,
 * so the regular expression costs the square of the run's length, and none of
 * these values is this module's to bound. Reading past the start of a string
 * gives `undefined`, which is not a slash, so the walk stops there without a
 * bound of its own.
 */
export function withoutTrailingSlash(value) {
  const text = String(value)
  let end = text.length
  while (text[end - 1] === '/') end -= 1
  return text.slice(0, end)
}
