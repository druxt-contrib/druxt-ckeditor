# DruxtCkeditor

Mounts the CKEditor 5 build Drupal ships in a [Druxt](https://druxtjs.org)
frontend. The editor a content author sees is the one Drupal is configured
with: the same plugins, the same toolbar, the same text format.

## Install

```sh
npm install @druxt-contrib/ckeditor
```

```js
// nuxt.config.js
export default {
  buildModules: ['druxt', '@druxt-contrib/ckeditor'],
  druxt: {
    baseUrl: 'https://drupal.example.com',
  },
}
```

```vue
<DruxtCkeditor v-model="body" format="basic_html" />
```

The options, the script sources and what happens when the backend is not
there are documented as the module is built. See the merge request for #1.

## The example application

`example/` pairs a Drupal 11 backend with a Nuxt application. `npm run
example:setup` assembles and provisions the backend, starts it, and installs
the frontend. `npm run example:dev` then serves it.

## Licence

MIT
