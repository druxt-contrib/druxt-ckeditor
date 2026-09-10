<template>
  <textarea :value="value" readonly />
</template>

<script>
/**
 * Shows the value in a textarea.
 *
 * The editor replaces the textarea once its scripts have loaded.
 */
export default {
  name: 'DruxtCkeditor',

  props: {
    /** The HTML to edit. */
    value: {
      type: String,
      default: '',
    },
  },
}
</script>
