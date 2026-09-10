import 'regenerator-runtime/runtime'
import { mount } from '@vue/test-utils'

import DruxtCkeditor from '../../src/components/DruxtCkeditor.vue'

describe('DruxtCkeditor', () => {
  test('shows the value in a textarea', () => {
    const wrapper = mount(DruxtCkeditor, { propsData: { value: '<p>Hi</p>' } })
    expect(wrapper.find('textarea').element.value).toBe('<p>Hi</p>')
  })

  test('starts empty', () => {
    const wrapper = mount(DruxtCkeditor)
    expect(wrapper.find('textarea').element.value).toBe('')
  })
})
