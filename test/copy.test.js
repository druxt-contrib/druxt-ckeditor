import assert from 'assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Readable } from 'stream'

import {
  COPY_PATH,
  copyScripts,
  presentSources,
  scriptMiddleware,
  scriptSources,
} from '../src/copy'

test('true reads the packages from node_modules through the resolver', () => {
  const asked = []
  const resolveModule = (request) => {
    asked.push(request)
    return request.includes('table')
      ? undefined
      : `/app/node_modules/${request}`
  }
  const sources = scriptSources(true, ['basic-styles', 'table'], {
    rootDir: '/app',
    resolveModule,
  })
  assert.deepEqual(asked, [
    'ckeditor5/build/ckeditor5-dll.js',
    '@ckeditor/ckeditor5-basic-styles/build/basic-styles.js',
    '@ckeditor/ckeditor5-table/build/table.js',
  ])
  assert.deepEqual(sources, [
    {
      name: 'ckeditor5-dll',
      source: '/app/node_modules/ckeditor5/build/ckeditor5-dll.js',
    },
    {
      name: 'basic-styles',
      source:
        '/app/node_modules/@ckeditor/ckeditor5-basic-styles/build/basic-styles.js',
    },
    { name: 'table', source: null },
  ])
})

test("a directory is read in Drupal's layout, against the application root", () => {
  const sources = scriptSources(
    '../drupal/web/core/assets/vendor/ckeditor5',
    ['link'],
    { rootDir: '/app/nuxt' }
  )
  assert.deepEqual(sources, [
    {
      name: 'ckeditor5-dll',
      source:
        '/app/drupal/web/core/assets/vendor/ckeditor5/ckeditor5-dll/ckeditor5-dll.js',
    },
    {
      name: 'link',
      source: '/app/drupal/web/core/assets/vendor/ckeditor5/link/link.js',
    },
  ])
})

test('a missing source is a warning naming the package, and is dropped', () => {
  const warnings = []
  const present = presentSources(
    [
      { name: 'ckeditor5-dll', source: '/x/core.js' },
      { name: 'table', source: null },
      { name: 'link', source: '/x/link.js' },
    ],
    {
      exists: (file) => file === '/x/core.js',
      warn: (message) => warnings.push(message),
    }
  )
  assert.deepEqual(present, [{ name: 'ckeditor5-dll', source: '/x/core.js' }])
  assert.equal(warnings.length, 2)
  assert.match(warnings[0], /"table"/)
  assert.match(warnings[1], /"link"/)
})

test("the copy lands in Drupal's layout", () => {
  const from = fs.mkdtempSync(path.join(os.tmpdir(), 'ckeditor-from-'))
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'ckeditor-into-'))
  fs.writeFileSync(path.join(from, 'core.js'), 'core')
  fs.writeFileSync(path.join(from, 'link.js'), 'link')
  copyScripts(
    [
      { name: 'ckeditor5-dll', source: path.join(from, 'core.js') },
      { name: 'link', source: path.join(from, 'link.js') },
    ],
    into,
    { copy: fs.copyFileSync, mkdir: fs.mkdirSync }
  )
  assert.equal(
    fs.readFileSync(
      path.join(into, 'ckeditor5-dll', 'ckeditor5-dll.js'),
      'utf8'
    ),
    'core'
  )
  assert.equal(
    fs.readFileSync(path.join(into, 'link', 'link.js'), 'utf8'),
    'link'
  )
})

test('the middleware serves a known script and passes everything else on', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ckeditor-mw-'))
  fs.writeFileSync(path.join(dir, 'link.js'), 'link')
  const handler = scriptMiddleware(
    [{ name: 'link', source: path.join(dir, 'link.js') }],
    { read: fs.createReadStream }
  )
  const headers = {}
  const chunks = []
  const res = {
    setHeader: (key, value) => (headers[key] = value),
    write: (chunk) => chunks.push(String(chunk)),
    end: () => {},
    on: () => {},
    once: () => {},
    emit: () => {},
  }
  return new Promise((resolve) => {
    res.end = () => {
      assert.equal(headers['Content-Type'], 'text/javascript; charset=utf-8')
      assert.equal(chunks.join(''), 'link')
      let passed = false
      handler({ url: '/table/table.js' }, res, () => (passed = true))
      assert.equal(passed, true)
      handler({}, res, () => (passed = 'again'))
      assert.equal(passed, 'again')
      resolve()
    }
    handler({ url: '/link/link.js?v=1' }, res, () =>
      assert.fail('a known script was passed on')
    )
  })
})

test('a failed read is passed on rather than thrown', () => {
  const failure = new Error('gone')
  const read = () =>
    new Readable({
      read() {
        this.destroy(failure)
      },
    })
  const handler = scriptMiddleware([{ name: 'link', source: '/x/link.js' }], {
    read,
  })
  const res = {
    setHeader: () => {},
    write: () => {},
    end: () => {},
    on: () => {},
    once: () => {},
    emit: () => {},
  }
  return new Promise((resolve) => {
    handler({ url: '/link/link.js' }, res, (error) => {
      assert.equal(error, failure)
      resolve()
    })
  })
})

test('the mount path is fixed', () => {
  assert.equal(COPY_PATH, '/ckeditor5')
})
