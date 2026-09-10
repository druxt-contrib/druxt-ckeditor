/**
 * Building a CKEditor toolbar from Drupal's own editor configuration.
 *
 * Drupal already knows what each text format's editor looks like: `editor--editor`
 * carries `settings.toolbar.items`, the exact list configured at
 * `/admin/config/content/formats`. Reading it means the frontend offers the
 * buttons the site was configured for rather than a set someone guessed, and a
 * change made in Drupal reaches the frontend without a deploy.
 *
 * That resource needs `administer filters` to read, so it is only available to
 * an authenticated author, which is the only time an editor is on screen
 * anyway. Anonymous gets the fallback.
 */

import { SUPPORTED_BUTTONS } from './loader'

/**
 * Buttons this build can render.
 *
 * Drupal's list is its own vocabulary and can name buttons that are not there:
 * `drupalInsertImage` is Drupal's own, and passing a button whose plugin is
 * missing throws `toolbarview-item-unavailable` and takes the whole editor down
 * with it. So the list is filtered to what `loader.js` has a plugin for.
 */
export const SUPPORTED = new Set([...SUPPORTED_BUTTONS, '|'])

/**
 * Drupal's name for a button, where CKEditor calls it something else.
 *
 * `drupalInsertImage` is the button Drupal's own module registers for inserting
 * an image. The thing it does is CKEditor's `uploadImage`, so the name is
 * translated rather than the button dropped: the site is configured to offer
 * image insertion, and it can be offered.
 */
export const ALIASES = {
  drupalInsertImage: 'uploadImage',
}

/** Used when Drupal's configuration cannot be read, which is the anonymous case. */
export const FALLBACK_TOOLBAR = [
  'heading',
  '|',
  'bold',
  'italic',
  'link',
  '|',
  'bulletedList',
  'numberedList',
  '|',
  'blockQuote',
  '|',
  'undo',
  'redo',
]

/**
 * Pick the editor configured for a text format out of a JSON:API collection.
 *
 * Matched on `drupal_internal__format`, the machine name the field's value
 * carries, rather than on the resource id, which the field never mentions.
 */
export function editorForFormat(resources, format) {
  if (!Array.isArray(resources) || !format) return null
  return (
    resources.find(
      (r) => ((r || {}).attributes || {}).drupal_internal__format === format
    ) || null
  )
}

/**
 * A configured list of buttons, reduced to the ones that can be rendered.
 *
 * Shared, because the list arrives two ways: over JSON:API from a session that
 * is allowed to read it, and baked into the build from the committed config for
 * every session that is not.
 *
 * Collapses runs of separators and trims them from the ends, because removing
 * an unsupported button often leaves a `|` with nothing on one side, which
 * renders as a stray divider.
 */
export function usableToolbar(configured) {
  if (!Array.isArray(configured) || !configured.length) return []

  const named = configured.map((item) => ALIASES[item] || item)
  const supported = named.filter((item) => SUPPORTED.has(item))
  const tidied = supported.filter(
    (item, i, all) => !(item === '|' && (i === 0 || all[i - 1] === '|'))
  )
  while (tidied.length && tidied[tidied.length - 1] === '|') tidied.pop()
  return tidied
}

/**
 * The toolbar for a format, as CKEditor wants it.
 */
export function toolbarFor(resources, format) {
  const editor = editorForFormat(resources, format)
  const items = (((editor || {}).attributes || {}).settings || {}).toolbar
  const usable = usableToolbar((items || {}).items || null)

  // Every configured button was one this build cannot render, which is a
  // configuration worth falling back from rather than showing an empty bar.
  return usable.length ? usable : [...FALLBACK_TOOLBAR]
}

/**
 * The items Drupal configured for a format, read through the Druxt store.
 *
 * A page's `fetch()` fills the store at generate time. The payload carries
 * it to the browser. So a static page can answer with no backend at all.
 *
 * Reading `editor--editor` needs that resource ticked in the Druxt module's
 * resource list. Without it the collection is empty or the read is refused.
 * Either way this yields nothing and the caller falls through.
 *
 * This is not `toolbarFor`. That one substitutes the fallback when it finds
 * nothing. The caller here has a better answer in its options.
 */
export async function configuredToolbar(store, format) {
  if (!store) return []
  try {
    const collection = await store.dispatch('druxt/getCollection', {
      type: 'editor--editor',
    })
    const editor = editorForFormat((collection || {}).data, format)
    const items = (((editor || {}).attributes || {}).settings || {}).toolbar
    return usableToolbar((items || {}).items)
  } catch {
    return []
  }
}
