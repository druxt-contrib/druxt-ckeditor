import fs from 'fs'
import os from 'os'
import { join } from 'path'

import NuxtModule, { DEFAULTS, resolveOptions } from '../src'

/** The parts of a Nuxt ModuleContainer the module touches. */
function nuxtMock({
  druxt = {},
  rootDir = '/app',
  resolveModule = () => undefined,
} = {}) {
  const dirs = []
  const hooks = {}
  const mock = {
    addPlugin: jest.fn(),
    addServerMiddleware: jest.fn(),
    extendBuild: jest.fn(),
    nuxt: {
      hook: jest.fn((name, fn) => {
        hooks[name] = fn
      }),
      resolver: { resolveModule: jest.fn(resolveModule) },
    },
    options: { rootDir, druxt },
  }
  return { mock, dirs, hooks }
}

describe('resolveOptions', () => {
  test('nothing configured is the defaults', () => {
    expect(resolveOptions()).toEqual(DEFAULTS)
    expect(resolveOptions({}, {})).toEqual(DEFAULTS)
  })

  test('druxt.ckeditor is merged over the defaults, one level deep for files and image', () => {
    const options = resolveOptions(
      {},
      {
        druxt: {
          ckeditor: {
            timeout: 1,
            files: { to: '/files/' },
            image: { toolbar: ['imageTextAlternative'] },
          },
        },
      }
    )
    expect(options.timeout).toBe(1)
    expect(options.files).toEqual({
      from: '/sites/default/files/',
      to: '/files/',
    })
    expect(options.image).toEqual({ toolbar: ['imageTextAlternative'] })
    expect(options.packages).toBe(DEFAULTS.packages)
  })

  test('module options win over druxt.ckeditor', () => {
    expect(
      resolveOptions({ timeout: 2 }, { druxt: { ckeditor: { timeout: 1 } } })
        .timeout
    ).toBe(2)
  })

  test('copy sets scripts to the served path unless scripts is set', () => {
    expect(resolveOptions({ copy: true }).scripts).toBe('/ckeditor5')
    expect(
      resolveOptions({ copy: '../drupal/web/core/assets/vendor/ckeditor5' })
        .scripts
    ).toBe('/ckeditor5')
    expect(
      resolveOptions({
        copy: true,
        scripts: 'https://cdn.example.net/ckeditor5',
      }).scripts
    ).toBe('https://cdn.example.net/ckeditor5')
    expect(
      resolveOptions({ scripts: 'https://cdn.example.net/ckeditor5' }).copy
    ).toBe(false)
  })
})

describe('DruxtCkeditor Nuxt module', () => {
  test('registers the components directory and the plugin', () => {
    const { mock, dirs, hooks } = nuxtMock()
    NuxtModule.call(mock, {})
    hooks['components:dirs'](dirs)
    expect(dirs).toEqual([{ path: join(__dirname, '..', 'src', 'components') }])
    expect(mock.addPlugin).toHaveBeenCalledTimes(1)
    const plugin = mock.addPlugin.mock.calls[0][0]
    expect(plugin.fileName).toBe('druxt-ckeditor.js')
    expect(plugin.src.endsWith(join('templates', 'plugin.js'))).toBe(true)
    expect(plugin.options).toEqual({ ...DEFAULTS, copy: false })
    expect(mock.addServerMiddleware).not.toHaveBeenCalled()
    expect(hooks['generate:distCopied']).toBeUndefined()
  })

  test('without module options', () => {
    // Nuxt calls a module with no options when it is registered as a bare
    // string in `buildModules`, which is how the example registers this one.
    const { mock } = nuxtMock({ druxt: { ckeditor: { timeout: 3 } } })
    NuxtModule.call(mock)
    expect(mock.addPlugin.mock.calls[0][0].options.timeout).toBe(3)
  })

  test('copy adds the middleware and the generate hook, and hides the path from the client', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { mock, hooks } = nuxtMock({
      resolveModule: (request) =>
        request.includes('table') ? undefined : `/app/node_modules/${request}`,
    })
    NuxtModule.call(mock, { copy: true, packages: ['table', 'link'] })
    expect(mock.addServerMiddleware).toHaveBeenCalledWith({
      path: '/ckeditor5',
      handler: expect.any(Function),
    })
    expect(hooks['generate:distCopied']).toEqual(expect.any(Function))
    const options = mock.addPlugin.mock.calls[0][0].options
    expect(options.copy).toBe(true)
    expect(options.scripts).toBe('/ckeditor5')
    // Nothing under /app/node_modules exists here, so every source is reported.
    expect(warn).toHaveBeenCalledTimes(3)
    expect(warn.mock.calls[1][0]).toMatch(/"table"/)
    warn.mockRestore()
  })

  test('the generate hook copies into the output', () => {
    // This test file stands in for the core build; the hook uses the real
    // file system, so it gets a directory it may write to.
    const { mock, hooks } = nuxtMock({ resolveModule: () => __filename })
    NuxtModule.call(mock, { copy: true, packages: [] })
    const distPath = fs.mkdtempSync(join(os.tmpdir(), 'ckeditor-dist-'))
    hooks['generate:distCopied']({ distPath })
    expect(
      fs.readdirSync(join(distPath, 'ckeditor5', 'ckeditor5-dll'))
    ).toEqual(['ckeditor5-dll.js'])
  })

  test('the client build gets an empty fs module', () => {
    const { mock } = nuxtMock()
    NuxtModule.call(mock, {})
    expect(mock.extendBuild).toHaveBeenCalledTimes(1)
    const extend = mock.extendBuild.mock.calls[0][0]
    const client = {}
    extend(client, { isClient: true })
    expect(client.node).toEqual({ fs: 'empty' })
    const server = { node: false }
    extend(server, { isClient: false })
    expect(server.node).toBe(false)
  })
})
