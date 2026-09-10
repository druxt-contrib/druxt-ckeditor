/**
 * Assembling CKEditor from Drupal's own DLL builds.
 *
 * A prebuilt bundle cannot be extended from outside. Importing a plugin
 * alongside it evaluates a second copy of CKEditor's core, which finds
 * `window.CKEDITOR_VERSION` already set and throws
 * `ckeditor-duplicated-modules`.
 *
 * So the plugins are loaded the way Drupal itself loads them: as DLL builds,
 * one script per package, sharing the core in `ckeditor5-dll.js`. No bundler
 * is involved, which is the point. They are plain scripts, fetched at runtime
 * from wherever the site says they are.
 *
 * They are fetched only when an editor is actually created. Together they are
 * over a megabyte, and a reader who never edits should never pay for them.
 */

/**
 * The core, which every other script attaches itself to, and so loads first.
 *
 * It carries more than its name suggests: `paragraph`, `typing`, `undo`,
 * `clipboard`, `widget` and `upload` all live in here rather than in packages
 * of their own.
 */
export const CORE = 'ckeditor5-dll'

/**
 * The packages to fetch, in load order.
 *
 * Everything Drupal's toolbar can ask for, plus the few that are not buttons:
 * `essentials` (undo, clipboard, enter), `autoformat`, `paste-from-office` and
 * `indent`, which lists and tables expect to be present.
 */
export const DEFAULT_PACKAGES = [
  'editor-classic',
  'essentials',
  'autoformat',
  'paste-from-office',
  'indent',
  'basic-styles',
  'remove-format',
  'block-quote',
  'heading',
  'link',
  'list',
  'table',
  'image',
  'code-block',
  'horizontal-line',
  'source-editing',
]

/**
 * Every plugin, loaded whatever the toolbar says.
 *
 * Not derived from the configured buttons, and the difference is not academic.
 * A CKEditor plugin decides what the editor *understands*; the toolbar only
 * decides what it *offers*. Markup the schema does not know about is stripped
 * on the way in, silently. Opening a site's own article with the image
 * plugins left out emptied every picture out of the body, and saving that
 * would have deleted them.
 *
 * So the plugin set is fixed and the toolbar is filtered separately. The
 * scripts are all fetched anyway, so this costs nothing but instantiation.
 *
 * Written as `namespace.Export` pairs against `window.CKEditor5`, because that
 * is the only handle a DLL build gives you.
 */
const PLUGINS = [
  'essentials.Essentials',
  'paragraph.Paragraph',
  'autoformat.Autoformat',
  'pasteFromOffice.PasteFromOffice',
  'indent.Indent',
  'basicStyles.Bold',
  'basicStyles.Italic',
  'basicStyles.Code',
  'basicStyles.Strikethrough',
  'basicStyles.Subscript',
  'basicStyles.Superscript',
  'removeFormat.RemoveFormat',
  'link.Link',
  'list.List',
  'blockQuote.BlockQuote',
  'table.Table',
  'table.TableToolbar',
  'horizontalLine.HorizontalLine',
  'heading.Heading',
  'codeBlock.CodeBlock',
  'sourceEditing.SourceEditing',
  'image.Image',
  'image.ImageToolbar',
  'image.ImageCaption',
  'image.ImageStyle',
  'image.ImageResize',
  'image.ImageUpload',
]

/**
 * What each configured button needs loaded.
 *
 * Keyed by Drupal's toolbar vocabulary, which is not CKEditor's: Drupal says
 * `bulletedList` where CKEditor wants the `List` plugin, and `insertTable`
 * needs `TableToolbar` as well or the table has no controls.
 *
 * Keyed by CKEditor's names, after `toolbar.js` has renamed the few Drupal
 * calls something else.
 */
export const BUTTON_PLUGINS = {
  bold: ['basicStyles.Bold'],
  italic: ['basicStyles.Italic'],
  strikethrough: ['basicStyles.Strikethrough'],
  subscript: ['basicStyles.Subscript'],
  superscript: ['basicStyles.Superscript'],
  code: ['basicStyles.Code'],
  removeFormat: ['removeFormat.RemoveFormat'],
  link: ['link.Link'],
  bulletedList: ['list.List'],
  numberedList: ['list.List'],
  blockQuote: ['blockQuote.BlockQuote'],
  insertTable: ['table.Table', 'table.TableToolbar'],
  horizontalLine: ['horizontalLine.HorizontalLine'],
  heading: ['heading.Heading'],
  codeBlock: ['codeBlock.CodeBlock'],
  sourceEditing: ['sourceEditing.SourceEditing'],
  uploadImage: [
    'image.Image',
    'image.ImageToolbar',
    'image.ImageCaption',
    'image.ImageStyle',
    'image.ImageResize',
    'image.ImageUpload',
  ],
  indent: ['indent.Indent'],
  outdent: ['indent.Indent'],
  undo: ['essentials.Essentials'],
  redo: ['essentials.Essentials'],
}

/** Buttons this build can render, which is what the toolbar is filtered to. */
export const SUPPORTED_BUTTONS = Object.keys(BUTTON_PLUGINS)

/** One script's URL under a base, in the layout Drupal serves. */
export function scriptUrl(base, name) {
  return `${String(base).replace(/\/+$/, '')}/${name}/${name}.js`
}

/**
 * Scripts fetched so far, by URL.
 *
 * Reused across editors: two fields on one form must not fetch a megabyte
 * twice, and loading the same DLL twice would register its plugins twice.
 */
const loaded = new Map()

/** Forget every script fetched so far. For tests. */
export function resetLoader() {
  loaded.clear()
}

/**
 * Fetch a script once, and tell the caller when the browser has run it.
 *
 * A script that neither loads nor errors within `timeout` milliseconds is
 * treated as failed. A firewalled host can hold a request open for minutes,
 * and an editor should not wait that long to fall back.
 *
 * A failure is not remembered, so a later editor on the same page tries again.
 */
export function loadScript(src, { document, timeout = 15000 } = {}) {
  if (loaded.has(src)) return loaded.get(src)
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    let timer = null
    const settle = (done) => () => {
      if (timer) clearTimeout(timer)
      script.onload = null
      script.onerror = null
      done()
    }
    script.src = src
    script.async = false
    script.onload = settle(resolve)
    script.onerror = settle(() => reject(new Error(`Could not load ${src}`)))
    if (timeout > 0) {
      timer = setTimeout(
        settle(() => reject(new Error(`Timed out loading ${src}`))),
        timeout
      )
    }
    document.head.appendChild(script)
  })
  promise.catch(() => loaded.delete(src))
  loaded.set(src, promise)
  return promise
}

/**
 * Load the core and every package, and hand back the namespace.
 *
 * The core is awaited on its own, because the package scripts attach to what
 * it defines and a parallel fetch would race it. The rest go together.
 *
 * Rejects rather than returning null, so the caller can say why. The plugin's
 * `load()` is the one that turns a failure into null.
 */
export async function loadCkeditor({
  base,
  packages = DEFAULT_PACKAGES,
  document = globalThis.document,
  window = globalThis.window,
  timeout,
} = {}) {
  if (!document) throw new Error('CKEditor needs a document to load into.')
  if (!base) throw new Error('No base URL to load CKEditor from.')
  await loadScript(scriptUrl(base, CORE), { document, timeout })
  await Promise.all(
    packages.map((name) =>
      loadScript(scriptUrl(base, name), { document, timeout })
    )
  )
  const namespace = (window || {}).CKEditor5
  if (!namespace)
    throw new Error(
      `The scripts under ${base} loaded but defined no CKEditor5 namespace.`
    )
  return namespace
}

/**
 * Resolve `namespace.Export` names against the loaded namespace.
 *
 * Anything missing is dropped rather than thrown on, because a plugin that
 * failed to arrive should cost its own button and not the whole editor. The
 * caller drops the matching buttons for the same reason.
 */
export function resolvePlugins(namespace, names) {
  const found = []
  for (const name of names) {
    const [group, exported] = name.split('.')
    const plugin = ((namespace || {})[group] || {})[exported]
    if (plugin && !found.includes(plugin)) found.push(plugin)
  }
  return found
}

/** Everything the editor should understand, which is everything that loaded. */
export function editorPlugins(namespace) {
  return resolvePlugins(namespace, PLUGINS)
}
