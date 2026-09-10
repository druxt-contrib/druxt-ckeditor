/**
 * The `$druxtCkeditor` plugin, rendered by Nuxt with the module's options.
 */
import { createCkeditor } from '@druxt-contrib/ckeditor'

// Nuxt renders this file as a lodash template; the placeholder becomes the
// options object as JSON, so the file is not JavaScript until then.
const options = <%= JSON.stringify(options) %>

export default (context, inject) => {
  inject('druxtCkeditor', createCkeditor(options, context))
}
