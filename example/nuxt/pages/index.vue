<template>
  <div>
    <h1>DruxtCkeditor example</h1>
    <p>
      The toolbar is the one Drupal configured for
      <code>basic_html</code>, read from the payload:
      <span data-testid="configured">{{ configured.join(' ') }}</span>
    </p>
    <DruxtCkeditor v-model="body" format="basic_html" />
    <h2>Stored HTML</h2>
    <pre data-testid="stored">{{ body }}</pre>
  </div>
</template>

<script>
import { configuredToolbar } from '@druxt-contrib/ckeditor'

export default {
  data: () => ({
    body: '<p>Hello from <strong>Drupal</strong>.</p>',
    configured: [],
  }),

  /**
   * Both collections at generate time, so the payload carries them and the
   * generated page reads Drupal's configuration with no backend.
   */
  async fetch() {
    await this.$store
      .dispatch('druxt/getCollection', { type: 'filter_format--filter_format' })
      .catch(() => null)
    this.configured = await configuredToolbar(this.$store, 'basic_html')
  },
}
</script>
