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

    /** Where the scripts come from: the option, or the backend's copy. */
    scripts: () =>
      options.scripts || (base() ? `${base()}${SCRIPTS_PATH}` : null),

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
