/**
 * Putting an image into the body from the browser.
 *
 * CKEditor knows how to take a dropped file and where to put the picture; it
 * does not know where the bytes go. That is an upload adapter, and without one
 * the image button is a button that fails. Drupal ships its own adapter that
 * posts to a route behind a session, which is no use here: this frontend is a
 * static site holding a bearer token, and the backend may not even be the one
 * that built it.
 *
 * So the bytes go over JSON:API, the same way `upload.js` already sends a
 * field's image, and the markup that comes out is the markup Drupal's own
 * editor writes.
 *
 * Two things about that markup matter, both established against a running
 * Drupal rather than from the documentation.
 *
 * An uploaded file is **temporary** until something references it. What makes
 * it permanent is `data-entity-uuid` in the saved text: `editor_entity_update()`
 * scans text fields for it and records file usage. An image inserted with only
 * a `src` looks right, survives the save, and is deleted by cron later.
 *
 * JSON:API has no route for creating a file on its own. Every upload route
 * belongs to a field, so a body image is posted through one and then never
 * attached to it. The field is a doorway, not where the picture ends up.
 */

import { uploadHeaders, uploadUrl } from './upload'

/**
 * Send one file and describe what came back.
 *
 * Returns the URL to show and the uuid to record. Absolute, because the editor
 * has to display the picture and a Drupal relative path would resolve against
 * the frontend, which does not serve it. `relativeFileUrls` puts it back before
 * anything is staged, so what gets committed is Drupal's own path.
 */
export async function uploadImage(file, options) {
  const { backendUrl, token, resourceType, field, request, hold } =
    options || {}

  // Nowhere to send it yet: hold the bytes with the change instead of refusing.
  // Editing works with no backend, and an image is the one thing that used to
  // need one before you could even put it on the page. What the editor shows
  // until then is the file itself, read in the browser.
  if (!backendUrl || !token || !field) {
    const dataUrl = await readAsDataUrl(file)
    if (typeof hold === 'function') hold(file, dataUrl)
    return { default: dataUrl, held: true }
  }

  const fetcher = request || globalThis.fetch
  const response = await fetcher(uploadUrl(backendUrl, resourceType, field), {
    method: 'POST',
    headers: uploadHeaders(file.name, token),
    body: file,
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    const reason =
      (detail &&
        detail.errors &&
        detail.errors[0] &&
        detail.errors[0].detail) ||
      `The image was refused with ${response.status}.`
    throw new Error(reason)
  }

  const body = await response.json()
  const data = (body || {}).data || {}
  const url =
    ((data.attributes || {}).uri || {}).url || (data.attributes || {}).url || ''
  return {
    default: absolute(url, backendUrl),
    uuid: data.id || '',
  }
}

/** A Drupal file URL the built site can actually fetch. */
export function absolute(url, backendUrl) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${String(backendUrl).replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

/**
 * What the editor needs to understand Drupal's images at all.
 *
 * Always loaded, whether or not anything can be uploaded, because this is about
 * reading and writing existing content rather than adding to it. Left out, an
 * author who opens an article loses its `data-entity-uuid` attributes simply by
 * saving, and nothing says so.
 *
 * Captions are not done here. They are a shape difference rather than a missing
 * attribute, and `captions.js` translates them on the way in and out,
 * where it can be tested without an editor. Doing it as a downcast converter
 * meant overriding the one that builds the image's figure, and CKEditor
 * answered `conversion-slot-filter-incomplete`.
 *
 * A class rather than a function, for `afterInit`. The image elements are
 * registered by the image plugins' own `init`, so extending the schema from
 * `init` is a race this loses: CKEditor answers
 * `schema-cannot-extend-missing-item` and the editor never opens. `afterInit`
 * runs once every plugin has registered what it owns, and still before the
 * document's data is loaded, which is the window this needs.
 */
export class DrupalImageCompatibility {
  constructor(editor) {
    this.editor = editor
  }

  afterInit() {
    allowEntityAttributes(this.editor)
  }
}

/**
 * Where the bytes go, which only exists when there is a backend to send to.
 *
 * Separate from the compatibility plugin on purpose: uploading is the optional
 * half, and understanding what is already there is not.
 */
export function imageUploadAdapter(options) {
  return class DecoupledImageUpload {
    constructor(editor) {
      this.editor = editor
    }

    init() {
      this.editor.plugins.get('FileRepository').createUploadAdapter = (
        loader
      ) => ({
        async upload() {
          return uploadImage(await loader.file, options)
        },
        // Nothing to call off: the request is already in flight or it is not.
        abort() {},
      })
    }

    afterInit() {
      recordUploadedUuid(this.editor)
    }
  }
}

/**
 * Let the two image elements carry Drupal's attributes, in both directions.
 *
 * Upcast as well as downcast, because an author opening an article that already
 * has images would otherwise strip the attributes off every one of them simply
 * by saving: CKEditor drops what its schema does not know about.
 */
function allowEntityAttributes(editor) {
  // Whichever of the two the loaded image plugins registered. A configuration
  // with only one of them is not this plugin's business to fail over.
  const elements = ['imageBlock', 'imageInline'].filter((name) =>
    editor.model.schema.isRegistered(name)
  )
  if (!elements.length) return

  for (const element of elements) {
    editor.model.schema.extend(element, {
      allowAttributes: ['dataEntityType', 'dataEntityUuid'],
    })
  }

  for (const [model, view] of [
    ['dataEntityType', 'data-entity-type'],
    ['dataEntityUuid', 'data-entity-uuid'],
  ]) {
    editor.conversion.for('upcast').attributeToAttribute({ view, model })
    editor.conversion.for('downcast').add((dispatcher) =>
      dispatcher.on(`attribute:${model}`, (event, data, api) => {
        if (!api.consumable.consume(data.item, event.name)) return
        const figure = api.mapper.toViewElement(data.item)
        const image =
          figure &&
          [...figure.getChildren()].find((c) => c.is('element', 'img'))
        const target = image || figure
        if (!target) return
        if (data.attributeNewValue === null) {
          api.writer.removeAttribute(view, target)
        } else {
          api.writer.setAttribute(view, data.attributeNewValue, target)
        }
      })
    )
  }
}

/** Stamp the uuid on the image the moment the upload answers with one. */
function recordUploadedUuid(editor) {
  const uploads =
    editor.plugins.has('ImageUploadEditing') &&
    editor.plugins.get('ImageUploadEditing')
  if (!uploads) return
  uploads.on('uploadComplete', (event, { data, imageElement }) => {
    if (!data || !data.uuid) return
    editor.model.change((writer) => {
      writer.setAttribute('dataEntityType', 'file', imageElement)
      writer.setAttribute('dataEntityUuid', data.uuid, imageElement)
    })
  })
}

/**
 * A chosen file as a data URL, which is what an editor with no backend can show.
 */
export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('That file could not be read.'))
    reader.readAsDataURL(file)
  })
}
