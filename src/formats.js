/**
 * What a text format does to the markup it stores.
 *
 * Two questions a decoupled editor has to answer before it writes anything:
 * which buttons the format is configured for, and which filters run when the
 * field is rendered. `editor.mjs` answers the first. This answers the second,
 * which decides where a caption belongs and would decide more if more of
 * Drupal's filters changed how content is stored.
 * Neither resource is readable on stock Druxt: `filter_format--filter_format`
 * needs `administer filters`, which is not a permission to hand an author,
 * because it also lets them rewrite the formats. Druxt's configurable resource
 * list (#3309969) is what makes it available to a session holding only
 * `access druxt resources`, and a site ticks it.
 *
 * A build-time copy stays the fallback. Editing works with no backend, and a
 * site that cannot read this still has to store captions somewhere.
 */

/** The filter that turns `data-caption` into a figure at render time. */
export const CAPTION_FILTER = 'filter_caption'

/**
 * The filters a format runs, from a `filter_format--filter_format` collection.
 *
 * Matched on `drupal_internal__format`, the machine name a field's value
 * carries, rather than on the resource id, which the field never mentions.
 */
export function filtersFromResources(resources, format) {
  if (!Array.isArray(resources) || !format) return null
  const found = resources.find(
    (resource) =>
      ((resource || {}).attributes || {}).drupal_internal__format === format
  )
  if (!found) return null
  return Object.keys((found.attributes || {}).filters || {})
}

/**
 * Ask Drupal which filters a format runs, through the Druxt store.
 *
 * Needs `filter_format--filter_format` ticked in the Druxt module's resource
 * list. Where it is not, or the store cannot answer, this says nothing rather
 * than guessing: null, which the caller tells apart from an empty answer.
 */
export async function filtersFor(store, format) {
  if (!store) return null
  try {
    const collection = await store.dispatch('druxt/getCollection', {
      type: 'filter_format--filter_format',
    })
    return filtersFromResources((collection || {}).data, format)
  } catch {
    return null
  }
}
