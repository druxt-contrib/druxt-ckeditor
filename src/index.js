/**
 * The Nuxt module.
 *
 * It merges the options and registers the component directory and the
 * plugin. When `copy` is set, it also serves the editor's scripts from the
 * site's own origin. Everything the component and the plugin need is
 * re-exported here. So a built component imports the package by name and
 * nothing else.
 */
import { join, resolve } from 'path'

// prettier-ignore
import { COPY_PATH, copyScripts, presentSources, scriptMiddleware, scriptSources } from './copy'
import { DRUPAL_FILES } from './files'
import { DEFAULT_PACKAGES } from './loader'

export * from './captions'
export * from './files'
export * from './formats'
export * from './image'
export * from './loader'
export * from './plugin'
export * from './toolbar'
export * from './upload'

/** The options, before the site says anything. */
export const DEFAULTS = {
  scripts: null,
  copy: false,
  packages: DEFAULT_PACKAGES,
  files: { from: DRUPAL_FILES, to: null },
  toolbars: {},
  filters: {},
  image: {
    toolbar: [
      'imageTextAlternative',
      'toggleImageCaption',
      '|',
      'imageStyle:inline',
      'imageStyle:block',
      'imageStyle:side',
    ],
  },
  timeout: 15000,
}

/**
 * The options as the plugin will see them.
 *
 * `druxt.ckeditor` in `nuxt.config.js` sits under the module options, so a
 * site can keep every Druxt setting in one place. `files` and `image` merge
 * one level deep, so setting `files.to` keeps `files.from`.
 */
export function resolveOptions(moduleOptions = {}, nuxtOptions = {}) {
  const configured = {
    ...((nuxtOptions.druxt || {}).ckeditor || {}),
    ...moduleOptions,
  }
  const options = {
    ...DEFAULTS,
    ...configured,
    files: { ...DEFAULTS.files, ...(configured.files || {}) },
    image: { ...DEFAULTS.image, ...(configured.image || {}) },
  }
  if (options.copy && !options.scripts) options.scripts = COPY_PATH
  return options
}

const NuxtModule = function (moduleOptions = {}) {
  const options = resolveOptions(moduleOptions, this.options)

  // The client bundle carries this file, because the component imports the
  // package by name. A browser build cannot resolve `fs`, and the copy
  // branch below never runs there. So the client build gets an empty `fs`.
  this.extendBuild((config, { isClient }) => {
    if (isClient) config.node = { ...(config.node || {}), fs: 'empty' }
  })

  this.nuxt.hook('components:dirs', (dirs) => {
    dirs.push({ path: join(__dirname, 'components') })
  })

  if (options.copy) {
    // Required here and not imported above: this file is also the client
    // bundle's entry, and only the Nuxt module runs in Node.
    const fs = require('fs')
    const sources = presentSources(
      scriptSources(options.copy, options.packages, {
        rootDir: this.options.rootDir,
        resolveModule: (request) => this.nuxt.resolver.resolveModule(request),
      }),
      { exists: fs.existsSync }
    )
    this.addServerMiddleware({
      path: COPY_PATH,
      handler: scriptMiddleware(sources, { read: fs.createReadStream }),
    })
    this.nuxt.hook('generate:distCopied', (generator) => {
      copyScripts(sources, join(generator.distPath, COPY_PATH), {
        copy: fs.copyFileSync,
        mkdir: fs.mkdirSync,
      })
    })
  }

  // The copy source is a path on the build machine; the client only needs to
  // know that there is one.
  this.addPlugin({
    src: resolve(__dirname, '../templates/plugin.js'),
    fileName: 'druxt-ckeditor.js',
    options: { ...options, copy: Boolean(options.copy) },
  })
}

export default NuxtModule
