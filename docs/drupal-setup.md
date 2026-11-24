# Drupal setup

The editor is Drupal's. The toolbar, the filters and the version all come from
the backend, so most of what makes this module work is configuration on the
Drupal side. This page is that configuration.

Nothing here is required to mount an editor. Without any of it the frontend
falls back to a built-in toolbar and stores captions as though the caption
filter were running. Configure the backend and the editor instead matches the
one the site's authors already use, and the markup it writes is the markup
Drupal renders.

## The resource list

The configuration is read from two JSON:API resources.

| Resource                       | What the frontend reads from it          |
| ------------------------------ | ---------------------------------------- |
| `editor--editor`               | `settings.toolbar.items`, the toolbar    |
| `filter_format--filter_format` | `filters`, which decides caption storage |

Neither is readable on a stock Druxt site. Tick both in the Druxt module's
configurable resource list, then grant `access druxt resources` to the role
that reads them, including the anonymous role for a frontend that builds
without signing in.

The resource list is what makes this safe to grant. Reading
`filter_format--filter_format` through Drupal's own access rules needs
`administer filters`, which also lets the holder rewrite every text format on
the site. That is not a permission to hand an author, and Druxt's resource
list is the reason the frontend does not need it.

Where a resource is not readable the frontend says so by falling back rather
than by failing. The `toolbars` and `filters` options answer first, and the
built-in toolbar answers after them.

## The text format

At `/admin/config/content/formats`, give the format CKEditor 5 as its editor
and configure the toolbar there. That toolbar is what the frontend renders.

Filters that change how content is stored are worth checking against what the
frontend does with it.

- **`filter_caption`** turns a `data-caption` attribute into a `<figure>` with
  a `<figcaption>` when the field is rendered. CKEditor has no schema for that
  attribute and keeps a caption as a figure instead, so the value is
  translated on the way into the editor and back on the way out. A format that
  does not run this filter has nowhere to put a caption, and the frontend
  leaves the markup alone.
- **`editor_file_reference`** is how Drupal records that a body field uses a
  file. It reads `data-entity-uuid`, which the frontend preserves. An image
  inserted with only a `src` looks right, saves, and is deleted by cron later.

A button Drupal offers that this build has no plugin for is dropped rather
than passed on. Passing one throws `toolbarview-item-unavailable`, which takes
the whole editor down, so the list is filtered to what the loader can supply.
`drupalInsertImage` is translated to CKEditor's `uploadImage` instead of being
dropped, because a site that configured image insertion can have it.

## A field for image uploads

An image inserted into the editor is a Drupal file, and JSON:API has no route
for creating a file on its own. Every upload route belongs to a field, so the
bytes go through one.

```vue
<DruxtCkeditor
  v-model="body"
  format="basic_html"
  :upload="{ resourceType: 'node--article', field: 'field_image' }"
/>
```

That posts to `/jsonapi/node/article/field_image` as raw bytes, with the
filename in a `Content-Disposition` header, and Drupal answers with a
`file--file` resource. The field is a doorway rather than where the picture
ends up, so the field can be any image field on the bundle.

The file arrives temporary, with `status: false`. Drupal's cron deletes
unreferenced temporary files, so an upload that is never attached to an entity
clears itself. Attaching it is an ordinary second request, and this module
does not make it.

## Authentication

The upload goes through the Druxt client, so it reaches Drupal the way every
other Druxt request does. With `druxt-auth` installed the request is sent with
the signed-in session's bearer token, and retried once when that token has
expired.
`druxt-auth` is not a dependency of this module, and the authentication is
picked up at runtime where it is present.

Give the role that uploads whatever permission the field needs, which is
ordinarily `create` on the bundle plus access to the field.

Without a session, or where the field refuses the request, the image is held
as a data URL and reported through the component's `hold` event. The editor
keeps editing, so nothing a reader typed is lost, and the site decides what to
do with the held file.

## The scripts

The scripts load as `<script>` elements from
`<druxt.baseUrl>/core/assets/vendor/ckeditor5`, so they are not subject to the
cross-origin rules that the JSON:API requests are. A backend the browser
cannot reach means a textarea rather than an error, so a site that builds
statically sets the `copy` option and serves its own copy. The README's
script sources section covers the choices.
