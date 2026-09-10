import { mount } from '@vue/test-utils'

import DruxtCkeditor from '../../src/components/DruxtCkeditor.vue'
import { DEFAULTS } from '../../src/index'
import * as loader from '../../src/loader'
import { createCkeditor } from '../../src/plugin'
import { FALLBACK_TOOLBAR } from '../../src/toolbar'

jest.mock('../../src/loader', () => ({
  ...jest.requireActual('../../src/loader'),
  loadCkeditor: jest.fn(),
}))

/** A namespace with one plugin per group the loader knows, and a fake editor. */
function fakeNamespace(created) {
  const Bold = class {}
  const Image = class {}
  const ClassicEditor = {
    create: jest.fn(async (host, config) => {
      const editor = fakeEditor(config)
      created.push({ host, config, editor })
      return editor
    }),
  }
  return {
    basicStyles: { Bold },
    image: { Image },
    editorClassic: { ClassicEditor },
  }
}

function fakeEditor(config) {
  const listeners = {}
  let data = config.initialData
  return {
    getData: () => data,
    setData: (next) => {
      data = next
    },
    type: (next) => {
      data = next
      listeners['change:data']()
    },
    editing: {
      view: {
        change: (fn) => fn({ addClass: () => {} }),
        document: { getRoot: () => ({}) },
      },
    },
    model: { document: { on: (name, fn) => (listeners[name] = fn) } },
    destroy: jest.fn(async () => {}),
  }
}

/** Mount with a plugin built from real options and a store that answers, or not. */
function mountEditor({
  props = {},
  options = {},
  baseUrl = 'https://drupal.example.com',
  store,
} = {}) {
  const plugin = createCkeditor(
    { ...DEFAULTS, ...options },
    { app: { $druxt: { options: { baseUrl } } } }
  )
  return mount(DruxtCkeditor, {
    propsData: { value: '<p>Hi</p>', format: 'basic_html', ...props },
    mocks: { $druxtCkeditor: plugin, $store: store },
  })
}

const editorResource = (items) => ({
  data: [
    {
      type: 'editor--editor',
      attributes: {
        drupal_internal__format: 'basic_html',
        settings: { toolbar: { items } },
      },
    },
  ],
})
const formatResource = (filters) => ({
  data: [
    {
      type: 'filter_format--filter_format',
      attributes: { drupal_internal__format: 'basic_html', filters },
    },
  ],
})

/** A store answering both collections. */
function storeWith({
  editors = editorResource(['bold', '|', 'drupalInsertImage']),
  formats = formatResource({ filter_caption: {} }),
} = {}) {
  return {
    dispatch: jest.fn(async (action, { type }) => {
      if (type === 'editor--editor') return editors
      if (type === 'filter_format--filter_format') return formats
      throw new Error(type)
    }),
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('DruxtCkeditor', () => {
  beforeEach(() => {
    loader.loadCkeditor.mockReset()
  })

  test('is a textarea until the editor is created, and stays one when the scripts fail', async () => {
    loader.loadCkeditor.mockRejectedValue(
      new Error('Could not load https://drupal.example.com/x.js')
    )
    const wrapper = mountEditor({ store: storeWith() })
    expect(wrapper.find('textarea').element.value).toBe('<p>Hi</p>')
    await flush()
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.emitted('error')).toHaveLength(1)
    expect(wrapper.emitted('error')[0][0].message).toMatch(/Could not load/)
    expect(wrapper.emitted('ready')).toBeUndefined()
    wrapper.find('textarea').setValue('<p>Typed</p>')
    expect(wrapper.emitted('input')).toEqual([['<p>Typed</p>']])
    expect(loader.loadCkeditor).toHaveBeenCalledWith({
      base: 'https://drupal.example.com/core/assets/vendor/ckeditor5',
      packages: DEFAULTS.packages,
      timeout: 15000,
    })
  })

  test('creates the editor from the configured toolbar with files and captions rewritten', async () => {
    const created = []
    loader.loadCkeditor.mockResolvedValue(fakeNamespace(created))
    const wrapper = mountEditor({
      props: {
        value:
          '<p><img src="/sites/default/files/a.png" data-caption="Hi"></p>',
        viewportOffset: 40,
      },
      store: storeWith(),
    })
    await flush()
    await flush()
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.emitted('ready')).toHaveLength(1)
    const { config, host } = created[0]
    expect(host).toBe(wrapper.find('.druxt-ckeditor__host').element)
    expect(config.toolbar.items).toEqual(['bold', '|', 'uploadImage'])
    expect(config.image.toolbar).toEqual(DEFAULTS.image.toolbar)
    expect(config.ui.viewportOffset).toEqual({ top: 40 })
    // Bold and Image from the namespace, then the two Drupal plugins.
    expect(config.plugins).toHaveLength(4)
    expect(config.initialData).toBe(
      '<p><figure class="image"><img src="https://drupal.example.com/sites/default/files/a.png"><figcaption>Hi</figcaption></figure></p>'
    )
  })

  test('what is typed comes out as what Drupal stores', async () => {
    const created = []
    loader.loadCkeditor.mockResolvedValue(fakeNamespace(created))
    const wrapper = mountEditor({
      options: { files: { from: '/sites/default/files/', to: '/files/' } },
      store: storeWith(),
    })
    await flush()
    await flush()
    created[0].editor.type(
      '<p><figure class="image"><img src="/files/b.png"><figcaption>Cap</figcaption></figure></p>'
    )
    expect(wrapper.emitted('input')).toEqual([
      ['<p><img src="/sites/default/files/b.png" data-caption="Cap"></p>'],
    ])
  })

  test('a new value from outside is pushed in, an echo is not', async () => {
    const created = []
    loader.loadCkeditor.mockResolvedValue(fakeNamespace(created))
    const wrapper = mountEditor({ store: storeWith() })
    await flush()
    await flush()
    const { editor } = created[0]
    const setData = jest.spyOn(editor, 'setData')
    await wrapper.setProps({ value: '<p>Hi</p>' })
    expect(setData).not.toHaveBeenCalled()
    await wrapper.setProps({ value: '<p>Other</p>' })
    expect(setData).toHaveBeenCalledWith('<p>Other</p>')
    wrapper.destroy()
    expect(editor.destroy).toHaveBeenCalled()
  })

  test('falls back to the options, then the built-in list, when the store cannot answer', async () => {
    const created = []
    loader.loadCkeditor.mockResolvedValue(fakeNamespace(created))
    const refusing = {
      dispatch: jest.fn(async () => {
        throw new Error('403')
      }),
    }
    mountEditor({
      options: { toolbars: { basic_html: ['italic', 'notAButton'] } },
      store: refusing,
    })
    await flush()
    await flush()
    expect(created[0].config.toolbar.items).toEqual(['italic'])

    mountEditor({ store: refusing })
    await flush()
    await flush()
    expect(created[1].config.toolbar.items).toEqual(FALLBACK_TOOLBAR)
  })

  test('explicit toolbar and filters props win, and no store is not an error', async () => {
    const created = []
    loader.loadCkeditor.mockResolvedValue(fakeNamespace(created))
    const wrapper = mountEditor({
      props: {
        toolbar: ['bold', '|', '|', 'italic', '|'],
        filters: [],
        value: '<p><img data-caption="Hi"></p>',
      },
    })
    await flush()
    await flush()
    expect(created[0].config.toolbar.items).toEqual(['bold', '|', 'italic'])
    // No filter_caption: captions stay as attributes on the way in.
    expect(created[0].config.initialData).toBe('<p><img data-caption="Hi"></p>')
    expect(wrapper.emitted('error')).toBeUndefined()
  })

  test('a format the store does not know runs filter_caption', async () => {
    const created = []
    loader.loadCkeditor.mockResolvedValue(fakeNamespace(created))
    mountEditor({
      props: { value: '<p><img data-caption="Hi"></p>' },
      store: storeWith({ formats: { data: [] } }),
    })
    await flush()
    await flush()
    expect(created[0].config.initialData).toMatch(
      /<figcaption>Hi<\/figcaption>/
    )
  })

  test('an editor that will not start keeps the textarea and says why', async () => {
    const namespace = fakeNamespace([])
    namespace.editorClassic.ClassicEditor.create = jest.fn(async () => {
      throw new Error('toolbar item not found')
    })
    loader.loadCkeditor.mockResolvedValue(namespace)
    const wrapper = mountEditor({ store: storeWith() })
    await flush()
    await flush()
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.emitted('error')[0][0].message).toMatch(/toolbar item/)
  })

  test('the upload adapter carries the props and emits hold', async () => {
    const created = []
    loader.loadCkeditor.mockResolvedValue(fakeNamespace(created))
    const wrapper = mountEditor({
      props: {
        upload: { resourceType: 'node--article', field: 'field_image' },
        token: 't',
        backendUrl: 'https://other.example.com',
      },
      store: storeWith(),
    })
    await flush()
    await flush()
    expect(wrapper.vm.uploadOptions).toMatchObject({
      backendUrl: 'https://other.example.com',
      token: 't',
      resourceType: 'node--article',
      field: 'field_image',
    })
    wrapper.vm.uploadOptions.hold({ name: 'a.png' }, 'data:,')
    expect(wrapper.emitted('hold')).toEqual([
      [{ file: { name: 'a.png' }, dataUrl: 'data:,' }],
    ])
  })
})
