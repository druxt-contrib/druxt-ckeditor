import assert from 'assert/strict'

import {
  DrupalImageCompatibility,
  absolute,
  imageUploadAdapter,
  readAsDataUrl,
  uploadImage,
} from '../src/image'

const originalFileReader = globalThis.FileReader

afterEach(() => {
  globalThis.FileReader = originalFileReader
})

/** A FileReader that answers with a fixed result, or fails. */
function fakeReader({
  result = 'data:image/png;base64,AAAA',
  fail = false,
} = {}) {
  return class {
    readAsDataURL() {
      queueMicrotask(() =>
        fail ? this.onerror() : ((this.result = result), this.onload())
      )
    }
  }
}

/**
 * Enough of a CKEditor editor for the two plugins.
 *
 * Records schema extensions, conversion handlers and attribute writes, so a
 * test can call the handlers the way CKEditor would.
 */
function fakeEditor({
  registered = ['imageBlock', 'imageInline'],
  uploads = true,
} = {}) {
  const extended = []
  const upcasts = []
  const downcasts = {}
  const written = []
  const listeners = {}
  let adapterFactory = null
  const editor = {
    model: {
      schema: {
        isRegistered: (name) => registered.includes(name),
        extend: (name, options) => extended.push([name, options]),
      },
      change: (fn) =>
        fn({
          setAttribute: (key, value, element) =>
            written.push([key, value, element]),
        }),
    },
    conversion: {
      for: (direction) => ({
        attributeToAttribute: (pair) => upcasts.push([direction, pair]),
        add: (fn) => fn({ on: (name, handler) => (downcasts[name] = handler) }),
      }),
    },
    plugins: {
      has: (name) => uploads && name === 'ImageUploadEditing',
      get: (name) => {
        if (name === 'FileRepository') {
          return {
            set createUploadAdapter(fn) {
              adapterFactory = fn
            },
          }
        }
        return { on: (name, handler) => (listeners[name] = handler) }
      },
    },
  }
  return {
    editor,
    extended,
    upcasts,
    downcasts,
    written,
    listeners,
    adapter: () => adapterFactory,
  }
}

/** The downcast API, with a figure holding an img or not. */
function downcastApi({ consumed = true, figure = 'img' } = {}) {
  const calls = []
  const img = { is: (type, name) => type === 'element' && name === 'img' }
  const other = { is: () => false }
  const figureElement =
    figure === null
      ? null
      : { getChildren: () => (figure === 'img' ? [other, img] : [other]) }
  const api = {
    consumable: { consume: () => consumed },
    mapper: { toViewElement: () => figureElement },
    writer: {
      setAttribute: (key, value, target) =>
        calls.push(['set', key, value, target]),
      removeAttribute: (key, target) => calls.push(['remove', key, target]),
    },
  }
  return { api, calls, img, figureElement }
}

test('an image with nowhere to go is held as a data URL', async () => {
  globalThis.FileReader = fakeReader()
  const held = []
  const file = { name: 'a.png', type: 'image/png' }
  const result = await uploadImage(file, {
    hold: (f, dataUrl) => held.push([f, dataUrl]),
  })
  assert.deepEqual(result, {
    default: 'data:image/png;base64,AAAA',
    held: true,
  })
  assert.deepEqual(held, [[file, 'data:image/png;base64,AAAA']])
})

test('a token with no field is held too, and hold is optional', async () => {
  globalThis.FileReader = fakeReader()
  const result = await uploadImage(
    { name: 'a.png' },
    { backendUrl: 'https://b.test', token: 't' }
  )
  assert.equal(result.held, true)
})

test('a file the browser cannot read is an error', async () => {
  globalThis.FileReader = fakeReader({ fail: true })
  await assert.rejects(readAsDataUrl({}), /could not be read/)
})

test('the bytes go to the field and the answer is absolute', async () => {
  const requests = []
  const request = async (url, init) => {
    requests.push([url, init])
    return {
      ok: true,
      json: async () => ({
        data: {
          id: 'uuid-1',
          attributes: { uri: { url: '/sites/default/files/a.png' } },
        },
      }),
    }
  }
  const file = { name: 'a.png' }
  const result = await uploadImage(file, {
    backendUrl: 'https://b.test/',
    token: 't',
    resourceType: 'node--article',
    field: 'field_image',
    request,
  })
  assert.deepEqual(result, {
    default: 'https://b.test/sites/default/files/a.png',
    uuid: 'uuid-1',
  })
  assert.equal(
    requests[0][0],
    'https://b.test/jsonapi/node/article/field_image'
  )
  assert.equal(requests[0][1].method, 'POST')
  assert.equal(requests[0][1].body, file)
  assert.equal(requests[0][1].headers.Authorization, 'Bearer t')
})

test('a flat url attribute and a missing id are tolerated', async () => {
  const request = async () => ({
    ok: true,
    json: async () => ({
      data: { attributes: { url: 'https://cdn.test/a.png' } },
    }),
  })
  const result = await uploadImage(
    { name: 'a.png' },
    { backendUrl: 'https://b.test', token: 't', field: 'f', request }
  )
  assert.deepEqual(result, { default: 'https://cdn.test/a.png', uuid: '' })
  const empty = async () => ({ ok: true, json: async () => null })
  assert.deepEqual(
    await uploadImage(
      { name: 'a.png' },
      { backendUrl: 'https://b.test', token: 't', field: 'f', request: empty }
    ),
    { default: '', uuid: '' }
  )
})

test("a refused upload carries Drupal's reason", async () => {
  const request = async () => ({
    ok: false,
    status: 415,
    json: async () => ({ errors: [{ detail: 'Not that kind of file.' }] }),
  })
  await assert.rejects(
    uploadImage(
      { name: 'a.png' },
      { backendUrl: 'https://b.test', token: 't', field: 'f', request }
    ),
    /Not that kind of file/
  )
})

test('a refusal with no body carries the status', async () => {
  const request = async () => ({
    ok: false,
    status: 500,
    json: async () => {
      throw new Error('not json')
    },
  })
  await assert.rejects(
    uploadImage(
      { name: 'a.png' },
      { backendUrl: 'https://b.test', token: 't', field: 'f', request }
    ),
    /refused with 500/
  )
})

test('a Drupal file URL is made absolute against the backend', () => {
  assert.equal(
    absolute('/sites/default/files/a.png', 'https://b.test/'),
    'https://b.test/sites/default/files/a.png'
  )
  assert.equal(
    absolute('sites/default/files/a.png', 'https://b.test'),
    'https://b.test/sites/default/files/a.png'
  )
  assert.equal(
    absolute('https://cdn.test/a.png', 'https://b.test'),
    'https://cdn.test/a.png'
  )
  assert.equal(absolute('', 'https://b.test'), '')
})

test('the compatibility plugin lets both image elements carry entity attributes', () => {
  const { editor, extended, upcasts, downcasts } = fakeEditor()
  new DrupalImageCompatibility(editor).afterInit()
  assert.deepEqual(
    extended.map(([name]) => name),
    ['imageBlock', 'imageInline']
  )
  assert.deepEqual(extended[0][1], {
    allowAttributes: ['dataEntityType', 'dataEntityUuid'],
  })
  assert.deepEqual(upcasts, [
    ['upcast', { view: 'data-entity-type', model: 'dataEntityType' }],
    ['upcast', { view: 'data-entity-uuid', model: 'dataEntityUuid' }],
  ])
  assert.deepEqual(Object.keys(downcasts), [
    'attribute:dataEntityType',
    'attribute:dataEntityUuid',
  ])
})

test('with no image element registered nothing is extended', () => {
  const { editor, extended, upcasts } = fakeEditor({ registered: [] })
  new DrupalImageCompatibility(editor).afterInit()
  assert.deepEqual(extended, [])
  assert.deepEqual(upcasts, [])
})

test('the downcast writes the attribute onto the img inside the figure', () => {
  const { editor, downcasts } = fakeEditor()
  new DrupalImageCompatibility(editor).afterInit()
  const handler = downcasts['attribute:dataEntityUuid']
  const { api, calls, img } = downcastApi()
  handler(
    { name: 'attribute:dataEntityUuid' },
    { item: {}, attributeNewValue: 'u-1' },
    api
  )
  assert.deepEqual(calls, [['set', 'data-entity-uuid', 'u-1', img]])
})

test('the downcast removes the attribute when the value is gone', () => {
  const { editor, downcasts } = fakeEditor()
  new DrupalImageCompatibility(editor).afterInit()
  const handler = downcasts['attribute:dataEntityType']
  const { api, calls, figureElement } = downcastApi({ figure: 'none' })
  handler(
    { name: 'attribute:dataEntityType' },
    { item: {}, attributeNewValue: null },
    api
  )
  assert.deepEqual(calls, [['remove', 'data-entity-type', figureElement]])
})

test('the downcast does nothing it cannot consume or map', () => {
  const { editor, downcasts } = fakeEditor()
  new DrupalImageCompatibility(editor).afterInit()
  const handler = downcasts['attribute:dataEntityType']
  const unconsumed = downcastApi({ consumed: false })
  handler(
    { name: 'attribute:dataEntityType' },
    { item: {}, attributeNewValue: 'file' },
    unconsumed.api
  )
  assert.deepEqual(unconsumed.calls, [])
  const unmapped = downcastApi({ figure: null })
  handler(
    { name: 'attribute:dataEntityType' },
    { item: {}, attributeNewValue: 'file' },
    unmapped.api
  )
  assert.deepEqual(unmapped.calls, [])
})

test('the upload adapter hands the file to uploadImage with the options', async () => {
  globalThis.FileReader = fakeReader()
  const { editor, adapter } = fakeEditor()
  const Plugin = imageUploadAdapter({})
  const plugin = new Plugin(editor)
  plugin.init()
  const instance = adapter()({ file: Promise.resolve({ name: 'a.png' }) })
  const result = await instance.upload()
  assert.equal(result.held, true)
  assert.equal(instance.abort(), undefined)
})

test('the upload adapter reads a function for its options at upload time', async () => {
  globalThis.FileReader = fakeReader()
  const { editor, adapter } = fakeEditor()
  let options = {}
  const Plugin = imageUploadAdapter(() => options)
  new Plugin(editor).init()
  const first = await adapter()({
    file: Promise.resolve({ name: 'a.png' }),
  }).upload()
  assert.equal(first.held, true)
  const sent = []
  options = {
    backendUrl: 'https://b.test',
    token: 't',
    resourceType: 'node--article',
    field: 'field_image',
    request: async (url, init) => {
      sent.push({ url, init })
      return {
        ok: true,
        json: async () => ({
          data: { id: 'u-1', attributes: { uri: { url: '/x.png' } } },
        }),
      }
    },
  }
  const second = await adapter()({
    file: Promise.resolve({ name: 'b.png' }),
  }).upload()
  assert.equal(sent.length, 1)
  assert.notEqual(second.held, true)
})

test('a finished upload stamps the uuid on the image', () => {
  const { editor, written, listeners } = fakeEditor()
  new (imageUploadAdapter({}))(editor).afterInit()
  const imageElement = {}
  listeners.uploadComplete({}, { data: { uuid: 'u-2' }, imageElement })
  assert.deepEqual(written, [
    ['dataEntityType', 'file', imageElement],
    ['dataEntityUuid', 'u-2', imageElement],
  ])
  listeners.uploadComplete({}, { data: { held: true }, imageElement })
  listeners.uploadComplete({}, { data: null, imageElement })
  assert.equal(written.length, 2)
})

test('an editor without image uploads has nothing to listen to', () => {
  const { editor, listeners } = fakeEditor({ uploads: false })
  new (imageUploadAdapter({}))(editor).afterInit()
  assert.deepEqual(listeners, {})
})
