---
'@druxt-contrib/ckeditor': patch
---

Widen the druxt peer range, so installing this module does not add a second
copy of druxt.

The range was `^0.21.0`, which for a 0.x version means `>=0.21.0 <0.22.0`. Any
site on a later druxt got a whole second copy installed beside its own to
satisfy the peer, and two copies of druxt means two JSON:API clients, two
caches, and a module registry the site's own druxt has never heard of.

Nothing here imports druxt. The module reads `$druxt.options.baseUrl` off the
context Druxt injects, which has not changed across 0.21 to 0.24, so the narrow
range described a constraint the code does not have.
