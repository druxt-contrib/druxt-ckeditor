import fs from 'fs'
import path from 'path'

/**
 * The plugin template is a lodash template Nuxt renders with the module's
 * options. Rendering it by hand keeps the test on the real file: the
 * substitution is one placeholder, and the import is the package's own
 * name, which is mapped to `src/` for Jest.
 */
function render(options) {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'templates', 'plugin.js'),
    'utf8'
  )
  const body = source
    .replace('<%= JSON.stringify(options) %>', JSON.stringify(options))
    .replace(
      /^import \{ createCkeditor \} from '@druxt-contrib\/ckeditor'\n/m,
      ''
    )
    .replace('export default', 'return')
  // eslint-disable-next-line no-new-func
  return new Function('createCkeditor', body)(
    require('../src/plugin').createCkeditor
  )
}

test('the template injects $druxtCkeditor with the rendered options', () => {
  const plugin = render({
    scripts: 'https://cdn.example.net/ckeditor5',
    files: { from: '/f/', to: null },
    packages: [],
    timeout: 1,
  })
  const injected = {}
  plugin(
    { app: { $druxt: { options: { baseUrl: 'https://drupal.example.com' } } } },
    (name, value) => (injected[name] = value)
  )
  expect(Object.keys(injected)).toEqual(['druxtCkeditor'])
  expect(injected.druxtCkeditor.scripts()).toBe(
    'https://cdn.example.net/ckeditor5'
  )
  expect(injected.druxtCkeditor.options.timeout).toBe(1)
})
