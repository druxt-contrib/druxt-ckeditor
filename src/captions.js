/**
 * Captions, which Drupal keeps in an attribute rather than in the markup.
 *
 * An image caption written in CKEditor is stored as `data-caption` on the
 * `<img>`, and Drupal's `filter_caption` turns it into a `<figure>` with a
 * `<figcaption>` when the field is rendered.
 *
 * CKEditor knows nothing about `data-caption`. It keeps a caption as a
 * `<figcaption>` inside `<figure class="image">`, and drops an attribute it
 * has no schema for. So the value is translated into that shape on the way
 * into the editor, and back on the way out.
 *
 * String work rather than DOM work, because this also has to run in the
 * tests.
 */

import { CAPTION_FILTER } from './formats'

/** Images and media that carry a caption, with the attribute in either quote. */
const CAPTIONED =
  /<(img|drupal-media)\b[^>]*\bdata-caption\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi

/** The attribute itself, so it can be taken back out of the tag. */
const CAPTION_ATTRIBUTE = /\s*\bdata-caption\s*=\s*("[^"]*"|'[^']*')/i

/**
 * An attribute value back into the markup it stands for.
 *
 * A caption is allowed to contain a link or an emphasis, and those arrive here
 * as `&lt;em&gt;`; leaving them encoded would print the tags at the reader.
 *
 * Numeric references are decoded as well as named ones, because what wrote the
 * attribute is not always what reads it: an apostrophe can arrive as `&#39;` or
 * as `&#x27;`, and handling only the first meant every round trip through the
 * editor re-encoded the ampersand of the second. The caption grew an `&amp;`
 * each time, and because the value never came back the same, the field decided
 * on every keystroke that it had changed and pushed itself into the editor
 * again.
 *
 * `&amp;` is decoded last, so a literal `&amp;lt;` stays the text it is.
 */
export function decodeAttribute(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .split('&lt;')
    .join('<')
    .split('&gt;')
    .join('>')
    .split('&quot;')
    .join('"')
    .split('&amp;')
    .join('&')
}

/**
 * The same caption, in the shape CKEditor works in.
 *
 * CKEditor keeps a caption as a `<figcaption>` inside `<figure class="image">`
 * and knows nothing about `data-caption`: an attribute it has no schema for is
 * dropped on the way in, so an article opened for editing came back with every
 * caption gone, silently, and saving that would have kept the loss.
 *
 * Translated here rather than in a downcast converter. Doing it in the pipeline
 * means overriding the converter that builds the image's figure, which is one
 * that fills slots, and CKEditor answers `conversion-slot-filter-incomplete`.
 * A pair of string transforms either side of the editor does the same job in a
 * place that can be tested without starting one, which is how the file URLs are
 * already handled.
 */
export function toEditorCaptions(html) {
  if (!html || !String(html).includes('data-caption')) return html

  return String(html).replace(
    CAPTIONED,
    (tag, _name, _quoted, double, single) => {
      const caption = double !== undefined ? double : single || ''
      const stripped = tag.replace(CAPTION_ATTRIBUTE, '')
      return `<figure class="image">${stripped}<figcaption>${decodeAttribute(caption)}</figcaption></figure>`
    }
  )
}

/** A figure CKEditor built, back to the attribute Drupal stores. */
const EDITOR_FIGURE =
  /<figure\b[^>]*\bclass\s*=\s*["'][^"']*\bimage\b[^"']*["'][^>]*>\s*(?<img><img\b[^>]*>)\s*<figcaption[^>]*>(?<caption>[\s\S]*?)<\/figcaption>\s*<\/figure>/gi

/**
 * The reverse, for anything on its way back out of the editor.
 *
 * A figure with no caption in it is left alone rather than unwrapped: that is
 * CKEditor's own markup for a plain block image, and Drupal stores it as such.
 */
export function fromEditorCaptions(html) {
  if (!html || !String(html).includes('<figcaption')) return html

  return String(html).replace(EDITOR_FIGURE, (figure, ...args) => {
    const { img, caption } = args[args.length - 1]
    const text = String(caption).trim()
    if (!text) return figure
    return img.replace(/\s*\/?>$/, ` data-caption="${encodeAttribute(text)}">`)
  })
}

/** The inverse of `decodeAttribute`, for putting markup back into an attribute. */
export function encodeAttribute(value) {
  return String(value || '')
    .split('&')
    .join('&amp;')
    .split('<')
    .join('&lt;')
    .split('>')
    .join('&gt;')
    .split('"')
    .join('&quot;')
}

/**
 * Whether captions belong in an attribute for this format.
 *
 * Only when Drupal will build the figure back. Writing `data-caption` into a
 * format that does not run `filter_caption` puts the words somewhere nothing
 * reads: the picture renders, the caption is gone, and no error is raised
 * anywhere. Leaving the editor's own `<figcaption>` alone is the safe answer,
 * because that at least renders as itself.
 *
 * Unknown formats are treated as running it. Every format that ships with
 * Drupal and permits images runs it, and the alternative default silently
 * changes how existing content is stored the first time a format cannot be
 * looked up.
 */
export function captionsAreAttributes(filters, format) {
  const known = (filters || {})[format]
  if (!Array.isArray(known)) return true
  return known.includes(CAPTION_FILTER)
}
