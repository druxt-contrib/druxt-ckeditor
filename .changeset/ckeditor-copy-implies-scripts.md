---
'@druxt-contrib/ckeditor': minor
---

Serve the editor from the site's own origin when the site copies the builds.

`copy` put the scripts under the site's own URL and then nothing pointed at
them: the plugin still asked the backend for its copy, so a site that set
`copy` got a second setting it had to discover and keep in agreement.

It also broke the case copying exists for. A static site with no backend
connected resolved the scripts against whatever base URL the build was made
with, which is a developer's own machine, so the editor never loaded and the
failure was silent.

`scripts` still wins where it is set, and the backend's copy is still the
answer when nothing was copied, since those builds match the Drupal that will
render the result.
