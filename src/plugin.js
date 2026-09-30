/**
 * The `$druxtCkeditor` plugin, one per app.
 *
 * Where the scripts and the files live is decided here, at call time. So a
 * site that repoints `$druxt.options.baseUrl` at runtime gets the editor from
 * the new backend on the next load. The Nuxt module only passes options
 * through. The base URL is the Druxt client's.
 */
import { loadCkeditor } from './loader'

/** Where Drupal serves the CKEditor 5 builds, under the site's base URL. */
export const SCRIPTS_PATH = '/core/assets/vendor/ckeditor5'

/**
 * Where the module serves its own copy of the builds, under the site's origin.
 *
 * Declared here rather than beside the copying, because the plugin has to read
 * it and the copying imports `path`, which has no business in a browser.
 */
export const COPY_PATH = '/ckeditor5'

/**
 * Build the plugin object from the resolved options and the Nuxt context.
 *
 * The Druxt client sits on `context.app.$druxt` when the plugin runs inside
 * the app. It sits on `context.$druxt` when the Druxt plugin has already
 * injected it on the context. Both are checked on every call. This plugin
 * must not depend on the order the modules were listed in.
 */
export function createCkeditor(options, context = {}) {
  const client = () =>
    (context.app && context.app.$druxt) || context.$druxt || null
  const base = () => {
    const druxt = client()
    const url = druxt && druxt.options ? druxt.options.baseUrl : null
    return url ? String(url).replace(/\/+$/, '') : null
  }

  const plugin = {
    options,

    /** The backend's origin, or null with no client. */
    backendUrl: () => base(),

    /**
     * Where the scripts come from.
     *
     * The option wins. Then this site's own copy, if the module was asked to
     * make one: a site that copies the builds wants to serve them, and
     * pointing at the backend instead would be a second setting that has to
     * agree with the first. It also means the editor still loads with no
     * backend connected, which is the whole point of staging edits offline.
     *
     * The backend's copy last, which is right when nothing was copied: the
     * builds match the Drupal that will render the result.
     *
     * `resolveOptions` in index.js sets the same copy-to-scripts default when
     * the module merges its options; this chain answers for a plugin built
     * from options directly. Keep the two in step.
     */
    scripts: () =>
      options.scripts ||
      (options.copy ? COPY_PATH : null) ||
      (base() ? `${base()}${SCRIPTS_PATH}` : null),

    /** Where the files are shown from: the option, or the backend's copy. */
    files: () => {
      const { from, to } = options.files
      return { from, to: to || (base() ? `${base()}${from}` : null) }
    },

    /** The `CKEditor5` namespace, or null when it could not be loaded. */
    load: () =>
      loadCkeditor({
        base: plugin.scripts(),
        packages: options.packages,
        timeout: options.timeout,
      }).catch(() => null),
  }

  return plugin
}
