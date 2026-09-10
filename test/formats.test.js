import assert from 'assert/strict'

import {
  CAPTION_FILTER,
  filtersFor,
  filtersFromResources,
} from '../src/formats'

const format = (name, filters) => ({
  type: 'filter_format--filter_format',
  attributes: { drupal_internal__format: name, filters },
})

test('the filters a format runs, by the name a field value carries', () => {
  const resources = [
    format('basic_html', { filter_caption: {}, filter_html: {} }),
    format('full_html', { filter_caption: {}, filter_align: {} }),
  ]
  assert.deepEqual(filtersFromResources(resources, 'basic_html'), [
    'filter_caption',
    'filter_html',
  ])
})

test('a format that runs no filters is an answer, not a missing one', () => {
  // The difference matters: "runs nothing" and "could not be read" lead to
  // different decisions about where a caption is stored.
  assert.deepEqual(filtersFromResources([format('plain', {})], 'plain'), [])
})

test('a format that is not in the collection reads as unknown', () => {
  assert.equal(
    filtersFromResources([format('basic_html', {})], 'full_html'),
    null
  )
})

test('no collection at all reads as unknown', () => {
  // Which is what an anonymous session gets: JSON:API answers 200 with nothing
  // in it rather than refusing outright.
  assert.equal(filtersFromResources([], 'full_html'), null)
  assert.equal(filtersFromResources(null, 'full_html'), null)
})

test('the filters come through the store', async () => {
  const dispatched = []
  const store = {
    dispatch: async (action, payload) => {
      dispatched.push([action, payload])
      return {
        data: [
          {
            attributes: {
              drupal_internal__format: 'basic_html',
              filters: { filter_caption: { status: true } },
            },
          },
        ],
      }
    },
  }
  assert.deepEqual(await filtersFor(store, 'basic_html'), ['filter_caption'])
  assert.deepEqual(dispatched, [
    ['druxt/getCollection', { type: 'filter_format--filter_format' }],
  ])
})

test('a store that cannot answer is no answer', async () => {
  const store = {
    dispatch: async () => {
      throw new Error('403')
    },
  }
  assert.equal(await filtersFor(store, 'basic_html'), null)
})

test('a format the store does not know is no answer either', async () => {
  const store = { dispatch: async () => ({ data: [] }) }
  assert.equal(await filtersFor(store, 'basic_html'), null)
})

test('no store is no answer', async () => {
  assert.equal(await filtersFor(null, 'basic_html'), null)
})

test('CAPTION_FILTER names the filter that renders the figure', () => {
  const resources = [format('full_html', { filter_caption: {} })]
  assert.equal(CAPTION_FILTER, 'filter_caption')
  assert.deepEqual(filtersFromResources(resources, 'full_html'), [
    CAPTION_FILTER,
  ])
})
