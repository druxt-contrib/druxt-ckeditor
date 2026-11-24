# Troubleshooting

Every failure in this module ends in one of two places. Either the editor
never appeared, and the field is still the textarea it starts as, or the
editor appeared and the markup it produced is not what Drupal stores. The two
have different causes and this page is split along that line.

## The field is still a textarea

That is the designed fallback. The component renders a `<textarea>` bound to
`v-model` until the editor is created, and keeps it if the editor never is, so
a reader can always type. The component's `error` event fires once with the
reason, which is the first thing to read.

```vue
<DruxtCkeditor v-model="body" format="basic_html" @error="console.error" />
```

**`Could not load <url>`** means the script was fetched and refused. Open that
URL. On the default configuration it is
`<druxt.baseUrl>/core/assets/vendor/ckeditor5/ckeditor5-dll/ckeditor5-dll.js`,
and a backend that is private, down, or not there at all answers nothing. A
static site that has to work without a backend sets the `copy` option.

**`Timed out loading <url>`** means the fetch is slow rather than refused.
`timeout` is 15000 milliseconds per script, and the packages are over a
megabyte together.

**A URL that 404s** usually means the files are not in Drupal's layout. The
loader expects `<scripts>/ckeditor5-dll/ckeditor5-dll.js` and then
`<scripts>/<package>/<package>.js`, one directory per package. A CDN or a
copied directory has to keep that shape.

**A second editor on the same page works and the first does not.** A failed
load is not remembered, so a later editor retries, but the instance that
failed stays a textarea rather than recovering on its own. Re-rendering it is
the way back.

**`copy` with a warning naming a package** means that package was not found
in the application's `node_modules` at build time. The editor loads without
it, so the symptom is a missing button rather than a missing editor. Install
`@ckeditor/ckeditor5-<package>` at the version the backend's Drupal includes,
which `core/core.libraries.yml` on the backend names.

## The editor works and the markup is wrong

**`ckeditor-duplicated-modules`** means two copies of CKEditor's core were
evaluated. This module loads Drupal's DLL builds, which share one core, and
nothing from `@ckeditor/*` belongs in the frontend bundle. Something that
imports a plugin directly is the cause. The `copy` option installs those
packages to copy their files, and a build that also imports them is the case
to look for.

**`toolbarview-item-unavailable`** means a button was passed whose plugin is
not loaded. The toolbar read from Drupal is filtered to what the loader
supplies, so this points at an explicit `toolbar` prop or a `toolbars` option
naming a button this build has no plugin for.

**The toolbar is not the one Drupal is configured with.** The frontend could
not read `editor--editor`, so the built-in toolbar answered. Tick that
resource in Druxt's resource list and grant `access druxt resources`, which
[Drupal setup](/drupal-setup) covers. A site that cannot grant it sets
`toolbars` per format instead.

**Captions disappear when an article is opened and saved.** CKEditor drops an
attribute it has no schema for, and `data-caption` is one. The module
translates a caption into the figure CKEditor understands on the way in and
back to the attribute on the way out, so a caption lost this way means the
markup never went through that translation. A format that does not run
`filter_caption` is stored as the editor wrote it, which is Drupal's own
behaviour for a format without the filter.

**A caption grows an `&amp;` every time it is saved.** An apostrophe arrives
as `&#39;` from one writer and `&#x27;` from another, and a decoder that
handles only the first leaves the second's ampersand to be encoded once more
on the next save. A field that compares what comes out of the editor with what
went in then reports an edit nobody made. Both spellings are decoded here, so
seeing this means the value is going through something other than this
module's own encode and decode pair.

**Images are broken in the editor but fine on the rendered page.** Drupal
writes its own path into the markup, `/sites/default/files/...`, which the
frontend's origin does not serve. The `files` option says where that path
points for the editor. Leaving `files.to` as `null` makes it absolute against
the backend, and setting it points at the site's own copy.

**An inserted image never reaches Drupal.** The component's `hold` event fires
with `{ file, dataUrl }` when there is nowhere to send the bytes, which means
no `upload` prop, no session, or a field that refused the request. The editor
carries on with the data URL so the draft is not lost.

## Reading the configuration the frontend actually used

`this.$druxtCkeditor` answers what was resolved rather than what was
configured, which is the quickest way to tell a configuration problem from a
network one.

```js
this.$druxtCkeditor.options // the merged options
this.$druxtCkeditor.scripts() // where the scripts are being loaded from
this.$druxtCkeditor.files() // the rewrite applied to body images
this.$druxtCkeditor.backendUrl() // the origin, from the Druxt client
await this.$druxtCkeditor.load() // the CKEditor5 namespace, or null
```

`load()` resolves to `null` rather than throwing, so it is a safe way to ask
whether the scripts are available at all.
