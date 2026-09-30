# Changelog

Changes to this module are recorded here. The format is
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The `DruxtCkeditor` component: a textarea until Drupal's CKEditor 5 build loads, then the editor with the format's configured toolbar.
- The `copy` option, serving the editor's scripts from the site's own origin for `nuxt dev`, `nuxt start` and `nuxt generate`.
- Image uploads through JSON:API, held as data URLs when there is no token.
