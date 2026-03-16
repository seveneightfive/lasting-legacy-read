// ═══════════════════════════════════════════════════════════════
// LASTING LEGACY ONLINE — Chapter Content Renderer
// Drop this into your read site to replace the existing chapter
// content rendering logic.
//
// This handles THREE content sources and weaves them together:
//   1. pages table  — main story content (from Glide Q&A)
//   2. gallery table — photos (linked to page_id OR chapter only)
//   3. HTML content — if content starts with '<', render as HTML
// ═══════════════════════════════════════════════════════════════

/**
 * Renders a full chapter's content as an HTML string.
 * @param {object} chapter - chapter row from Supabase
 * @param {array}  pages   - pages rows for this chapter, sorted by sort_order
 * @param {array}  gallery - gallery rows for this chapter
 * @returns {string} HTML string ready to set as innerHTML
 */
export function renderChapter(chapter, pages, gallery) {
  const sortedPages = [...pages].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const chapterGallery = gallery.filter(g => g.chapter_id === chapter.id);

  let html = "";

  // Chapter lede (intro text)
  if (chapter.lede) {
    html += `<p class="chapter-lede">${escHtml(chapter.lede)}</p>`;
  }

  // Render each page
  sortedPages.forEach(page => {
    // Page-linked gallery images that appear BEFORE the text
    const pageImgsBefore = chapterGallery
      .filter(g => g.page_id === page.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    html += `<div class="story-section">`;

    // Section heading (subtitle)
    if (page.subtitle) {
      html += `<h3 class="section-heading">${escHtml(page.subtitle)}</h3>`;
    }

    // Page image (from pages.image_url — the primary/header image)
    if (page.image_url) {
      html += `<figure class="page-image page-image--header">
        <img src="${escHtml(page.image_url)}" alt="${escHtml(page.image_caption || '')}" loading="lazy" />
        ${page.image_caption ? `<figcaption>${escHtml(page.image_caption)}</figcaption>` : ""}
      </figure>`;
    }

    // Main content — detect HTML vs markdown
    if (page.content) {
      const trimmed = page.content.trim();
      if (trimmed.startsWith("<")) {
        // Already HTML (from new editor) — render directly
        html += `<div class="story-content">${page.content}</div>`;
      } else {
        // Legacy markdown/plain text — convert
        html += `<div class="story-content">${markdownToHtml(page.content)}</div>`;
      }
    }

    // Gallery images linked to this specific page — shown inline after text
    if (pageImgsBefore.length > 0) {
      if (pageImgsBefore.length === 1) {
        // Single image — show full width
        const img = pageImgsBefore[0];
        html += `<figure class="page-image page-image--inline">
          <img src="${escHtml(img.image_url)}" alt="${escHtml(img.image_caption || '')}" loading="lazy" />
          ${img.image_caption ? `<figcaption>${escHtml(img.image_caption)}</figcaption>` : ""}
        </figure>`;
      } else {
        // Multiple images — show as a responsive grid
        html += `<div class="image-grid image-grid--${Math.min(pageImgsBefore.length, 3)}col">`;
        pageImgsBefore.forEach(img => {
          html += `<figure class="image-grid__item">
            <img src="${escHtml(img.image_url)}" alt="${escHtml(img.image_caption || '')}" loading="lazy" />
            ${img.image_caption ? `<figcaption>${escHtml(img.image_caption)}</figcaption>` : ""}
          </figure>`;
        });
        html += `</div>`;
      }
    }

    // Pull quote
    if (page.quote) {
      html += `<blockquote class="pull-quote">
        <p>${escHtml(page.quote)}</p>
        ${page.quote_attribute ? `<cite>— ${escHtml(page.quote_attribute)}</cite>` : ""}
      </blockquote>`;
    }

    html += `</div>`; // .story-section
  });

  // Chapter-level gallery images (not linked to any specific page)
  // These appear at the end of the chapter
  const floatingImages = chapterGallery
    .filter(g => !g.page_id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  if (floatingImages.length > 0) {
    html += `<div class="chapter-gallery">`;
    html += `<h4 class="chapter-gallery__title">Photos</h4>`;
    html += `<div class="image-grid image-grid--${Math.min(floatingImages.length, 3)}col">`;
    floatingImages.forEach(img => {
      html += `<figure class="image-grid__item">
        <img src="${escHtml(img.image_url)}" alt="${escHtml(img.image_caption || '')}" loading="lazy" />
        ${img.image_caption ? `<figcaption>${escHtml(img.image_caption)}</figcaption>` : ""}
      </figure>`;
    });
    html += `</div></div>`;
  }

  return html;
}

/**
 * Convert markdown-ish text to HTML.
 * Handles the formatting used in Glide question answers.
 */
function markdownToHtml(text) {
  if (!text) return "";
  return text
    .replace(/\*\*_(.+?)_\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\n<br>\n/g, "\n")
    .replace(/<br>/g, "\n")
    .split(/\n\n+/)
    .map(para => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      if (trimmed.match(/^<[h1-6]|^<blockquote/)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
}

function escHtml(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}


// ═══════════════════════════════════════════════════════════════
// CSS to add to your read site's stylesheet
// ═══════════════════════════════════════════════════════════════
export const CHAPTER_STYLES = `
.chapter-lede {
  font-style: italic;
  color: #8a7560;
  font-size: 1.05rem;
  line-height: 1.7;
  margin-bottom: 2rem;
  border-left: 3px solid #c9a84c;
  padding-left: 1rem;
}

.story-section {
  margin-bottom: 2.5rem;
}

.section-heading {
  font-family: 'Playfair Display', serif;
  font-size: 1.15rem;
  color: #3d2b1a;
  margin-bottom: 0.75rem;
  margin-top: 0;
}

.story-content {
  line-height: 1.85;
  font-size: 1rem;
}
.story-content p { margin-bottom: 1rem; }
.story-content h1, .story-content h2, .story-content h3 {
  font-family: 'Playfair Display', serif;
  color: #3d2b1a;
  margin: 1.5rem 0 0.5rem;
}
.story-content blockquote {
  border-left: 3px solid #c9a84c;
  padding: 0.5rem 1rem;
  margin: 1rem 0;
  color: #6b4c2a;
  font-style: italic;
  background: #faf7f2;
}
.story-content figure {
  margin: 1.5rem 0;
  text-align: center;
}
.story-content figure img {
  max-width: 100%;
  border-radius: 6px;
}
.story-content figcaption {
  font-size: 0.82rem;
  color: #8a7560;
  font-style: italic;
  margin-top: 0.4rem;
}

/* Inline images */
.page-image {
  margin: 1.5rem 0;
  text-align: center;
}
.page-image img {
  max-width: 100%;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}
.page-image figcaption {
  font-size: 0.82rem;
  color: #8a7560;
  font-style: italic;
  margin-top: 0.5rem;
}
.page-image--header img {
  max-height: 400px;
  object-fit: cover;
  width: 100%;
}

/* Image grids */
.image-grid {
  display: grid;
  gap: 12px;
  margin: 1.5rem 0;
}
.image-grid--1col { grid-template-columns: 1fr; }
.image-grid--2col { grid-template-columns: 1fr 1fr; }
.image-grid--3col { grid-template-columns: 1fr 1fr 1fr; }
@media (max-width: 600px) {
  .image-grid--2col,
  .image-grid--3col { grid-template-columns: 1fr 1fr; }
}
.image-grid__item {
  margin: 0;
}
.image-grid__item img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.image-grid__item figcaption {
  font-size: 0.75rem;
  color: #8a7560;
  font-style: italic;
  margin-top: 4px;
  text-align: center;
}

/* Pull quotes */
.pull-quote {
  border-left: 4px solid #c9a84c;
  background: #faf7f2;
  padding: 1rem 1.5rem;
  margin: 2rem 0;
  border-radius: 0 6px 6px 0;
}
.pull-quote p {
  font-family: 'Playfair Display', serif;
  font-size: 1.1rem;
  font-style: italic;
  color: #3d2b1a;
  margin: 0 0 0.5rem;
}
.pull-quote cite {
  font-size: 0.85rem;
  color: #8a7560;
}

/* Chapter-level photo gallery */
.chapter-gallery {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid #d4c8b0;
}
.chapter-gallery__title {
  font-family: 'Playfair Display', serif;
  font-size: 1rem;
  color: #8a7560;
  margin-bottom: 1rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
`;


// ═══════════════════════════════════════════════════════════════
// HOW TO USE IN YOUR BOLT/READ SITE
// ═══════════════════════════════════════════════════════════════
//
// 1. Add this file to your read site repo as:
//    src/lib/chapterRenderer.js  (or .ts)
//
// 2. In your chapter display component, replace existing
//    content rendering with:
//
//    import { renderChapter, CHAPTER_STYLES } from '../lib/chapterRenderer';
//
//    // In your component:
//    const chapterHtml = renderChapter(chapter, pages, gallery);
//
//    // In JSX:
//    <div
//      className="chapter-body"
//      dangerouslySetInnerHTML={{ __html: chapterHtml }}
//    />
//
// 3. Add CHAPTER_STYLES to your global CSS, OR add this to your
//    main stylesheet or <style> tag:
//    const styleEl = document.createElement('style');
//    styleEl.textContent = CHAPTER_STYLES;
//    document.head.appendChild(styleEl);
//
// 4. Your Supabase query for the read site should fetch:
//    - chapters (for this book)
//    - pages (for each chapter)
//    - gallery (for each chapter)  ← make sure this is included!
//
//    Example query:
//    const { data: gallery } = await supabase
//      .from('gallery')
//      .select('*')
//      .in('chapter_id', chapterIds)
//      .order('sort_order');
// ═══════════════════════════════════════════════════════════════

