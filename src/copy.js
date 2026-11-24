/**
 * Serving the editor's scripts from the site's own origin.
 *
 * Most builds cannot reach the backend. A static site has no backend at all
 * when it is viewed. `copy` gives the module another source for the scripts.
 * It can be the application's `node_modules`. It can also be a directory in
 * Drupal's layout, such as a backend checkout's
 * `web/core/assets/vendor/ckeditor5`.
 *
 * Nothing is written into the application's source tree. A server middleware
 * serves the files for `nuxt dev` and `nuxt start`. `nuxt generate` copies
 * them into the output.
 *
 * This file never imports Node's file system module. The Nuxt module hands
 * in the functions it needs. The client bundle carries the Nuxt module next
 * to the plugin's exports, and this file with it, so `fs` must stay out.
 */
import { join, resolve } from 'path'

import { CORE } from './loader'

/** Where the module serves the scripts from the site's own origin. */
export { COPY_PATH } from './plugin'

/** The npm package and build file for one of Drupal's package names. */
function packageFile(name) {
  if (name === CORE) return `ckeditor5/build/${CORE}.js`
  return `@ckeditor/ckeditor5-${name}/build/${name}.js`
}

/**
 * Where each script comes from.
 *
 * With `true`, each package is found through the resolver Nuxt hands the
 * module. That resolver sees hoisted packages and workspaces the way the
 * application's own imports do. With a string, the scripts are read from a
 * directory in Drupal's layout, resolved against the application's root.
 * A package the resolver cannot find has a null source. `presentSources`
 * reports it.
 */
export function scriptSources(copy, packages, { rootDir, resolveModule } = {}) {
  const names = [CORE, ...packages]
  if (copy === true) {
    return names.map((name) => ({
      name,
      source: resolveModule(packageFile(name)) || null,
    }))
  }
  const dir = resolve(rootDir || '', String(copy))
  return names.map((name) => ({ name, source: join(dir, name, `${name}.js`) }))
}

/** The sources that exist, with a warning for each that does not. */
export function presentSources(sources, { exists, warn = console.warn }) {
  return sources.filter(({ name, source }) => {
    const found = Boolean(source) && exists(source)
    if (!found)
      warn(
        `[druxt-ckeditor] No build found for "${name}"; the editor loads without it.`
      )
    return found
  })
}

/** Copy every source into a directory, in Drupal's layout. */
export function copyScripts(sources, into, { copy, mkdir }) {
  for (const { name, source } of sources) {
    const dir = join(into, name)
    mkdir(dir, { recursive: true })
    copy(source, join(dir, `${name}.js`))
  }
}

/**
 * A server middleware for the sources, mounted at `COPY_PATH`.
 *
 * Nuxt strips the mount path before it calls the handler. So the request URL
 * is `/<name>/<name>.js`. Any other URL is passed on. A read error is passed
 * on too, so a failed read does not take the server down.
 */
export function scriptMiddleware(sources, { read }) {
  const files = new Map(
    sources.map(({ name, source }) => [`/${name}/${name}.js`, source])
  )
  return (req, res, next) => {
    const source = files.get(String(req.url || '').split('?')[0])
    if (!source) return next()
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
    read(source).on('error', next).pipe(res)
  }
}
