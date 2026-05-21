/**
 * Cleans up legacy WordPress markup that came in via migrations.
 *
 * Handles:
 *  - [caption ...]...[/caption] shortcodes → <figure> with <figcaption>
 *  - [gallery ...] shortcodes → removed (we use the gallery table instead)
 *  - <figure class="wp-block-embed ...">VIMEO URL</figure> → real iframe (or removed if not video)
 *  - Stale image URLs pointing to my.lastinglegacyonline.com that 404 → kept as-is for now
 *    (we don't know which are broken without fetching each)
 *  - Stripped: empty <p> tags, wp-element-button blocks
 *
 * The sanitizer is intentionally conservative — it never removes prose,
 * only markup wrappers and shortcodes. If unsure, it leaves content alone.
 */

const VIMEO_RE = /https?:\/\/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i;
const YOUTUBE_RE = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/i;

export function sanitizeWordPressHtml(input: string | null | undefined): string {
  if (!input) return '';
  let html = input;

  // 1) [caption id="..." align="..." width="..."]<img ...>CAPTION TEXT[/caption]
  //    → <figure><img ...><figcaption>CAPTION TEXT</figcaption></figure>
  html = html.replace(
    /\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi,
    (_, inner) => {
      const trimmed = String(inner).trim();
      // Try to split on the first <img ... > closing
      const imgMatch = trimmed.match(/(<img\b[^>]*>)/i);
      if (!imgMatch) return trimmed;
      const img = imgMatch[1];
      const caption = trimmed.replace(img, '').trim()
        .replace(/^<br\s*\/?>/i, '')
        .replace(/<br\s*\/?>$/i, '')
        .trim();
      if (!caption) return `<figure>${img}</figure>`;
      return `<figure>${img}<figcaption>${caption}</figcaption></figure>`;
    }
  );

  // 2) [gallery ids="..."] → removed (managed via the gallery table now)
  html = html.replace(/\[gallery[^\]]*\]/gi, '');

  // 3) wp-block-embed (vimeo / youtube): replace the figure block with an iframe embed.
  //    These look like: <figure class="wp-block-embed ..."><div class="wp-block-embed__wrapper">URL</div></figure>
  html = html.replace(
    /<figure[^>]*class="[^"]*wp-block-embed[^"]*"[^>]*>([\s\S]*?)<\/figure>/gi,
    (match, inner) => {
      const text = String(inner);
      const vimeo = text.match(VIMEO_RE);
      if (vimeo) {
        return `<figure class="video-embed"><div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;"><iframe src="https://player.vimeo.com/video/${vimeo[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div></figure>`;
      }
      const youtube = text.match(YOUTUBE_RE);
      if (youtube) {
        return `<figure class="video-embed"><div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;"><iframe src="https://www.youtube.com/embed/${youtube[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div></figure>`;
      }
      // Unknown embed type — drop the wrapper but keep the inner content (often a URL)
      return text;
    }
  );

  // 4) Strip wp-block-button / wp-element-button (these are CTAs, not story content)
  html = html.replace(/<div[^>]*class="[^"]*wp-block-button[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

  // 5) Collapse empty paragraphs and whitespace-only paragraphs
  html = html.replace(/<p>\s*(?:&nbsp;|\u00a0)?\s*<\/p>/gi, '');

  // 6) Strip WordPress-specific class wrappers but keep the content
  //    e.g. <div class="wp-block-group">...</div> → ...
  html = html.replace(/<div[^>]*class="[^"]*wp-block-(?:group|spacer|separator)[^"]*"[^>]*>/gi, '');
  html = html.replace(/<\/div>\s*(?=<p>|<figure|<h[1-6]|<ul|<ol|<blockquote|$)/gi, '');

  // 7) Trim
  html = html.replace(/^\s+|\s+$/g, '');

  return html;
}

/**
 * Returns true if the input contains likely WordPress legacy markup
 * that the sanitizer would change. Used to show a "Clean up legacy markup?"
 * hint in the editor.
 */
export function hasWordPressMarkup(input: string | null | undefined): boolean {
  if (!input) return false;
  return (
    /\[caption[^\]]*\]/i.test(input) ||
    /\[gallery[^\]]*\]/i.test(input) ||
    /wp-block-embed/i.test(input) ||
    /wp-block-button/i.test(input) ||
    /wp-element-button/i.test(input)
  );
}
