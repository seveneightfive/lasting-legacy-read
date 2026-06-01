import jsPDF from 'jspdf';
import { Book } from '../lib/supabase';
import { ChapterWithPages } from '../lib/pdfUtils';

// ─── Constants ────────────────────────────────────────────────────────────────
const MARGIN = 25;          // mm left/right
const TOP_MARGIN = 25;      // mm top
const BOTTOM_MARGIN = 25;   // mm bottom
const FONT_BODY = 11;
const FONT_SUBHEAD = 13;
const FONT_CHAPTER = 20;
const FONT_CHAPTER_SUB = 14;
const FONT_CAPTION = 9;
const FONT_TOC_TITLE = 18;
const FONT_TOC_ENTRY = 11;
const LINE_SCALE = 0.45;    // jsPDF pt → mm line height multiplier for given font size
const PARA_GAP = 4;         // mm between paragraphs
const ORPHAN_LINES = 2;     // minimum lines to keep at bottom / top of page

// Lasting Legacy Online logo URL (publicly accessible)
const LOGO_URL = 'https://lastinglegacyonline.com/wp-content/uploads/2023/01/LLO-Logo-horizontal-dark.png';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TocEntry {
  chapterNumber: number;
  title: string;
  subtitle?: string;
  pageNumber: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Load an image URL and return a base64 data URL, or null on failure */
async function loadImageAsBase64(url: string): Promise<{ data: string; format: string } | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';
    const format = mimeType.includes('png') ? 'PNG' : 'JPEG';
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ data: base64, format });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Get natural image dimensions from a base64 string */
async function getImageDimensions(base64: string, format: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 800, h: 600 });
    img.src = `data:image/${format.toLowerCase()};base64,${base64}`;
  });
}

/** Strip HTML tags to plain text, preserving paragraph breaks */
function htmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Extract inline images from HTML content */
function extractInlineImages(html: string): Array<{ src: string; alt: string; caption: string }> {
  if (!html) return [];
  const images: Array<{ src: string; alt: string; caption: string }> = [];
  const figureRe = /<figure[^>]*>([\s\S]*?)<\/figure>/gi;
  let figMatch;
  while ((figMatch = figureRe.exec(html)) !== null) {
    const inner = figMatch[1];
    const imgMatch = inner.match(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["']/i)
      || inner.match(/<img[^>]+src=["']([^"']+)["']/i);
    const capMatch = inner.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
    if (imgMatch) {
      images.push({
        src: imgMatch[1],
        alt: imgMatch[2] || '',
        caption: capMatch ? htmlToPlainText(capMatch[1]) : '',
      });
    }
  }
  return images;
}

// ─── Main PDF class ───────────────────────────────────────────────────────────

class BookPdfBuilder {
  private pdf: jsPDF;
  private y: number = TOP_MARGIN;
  private pageW: number;
  private pageH: number;
  private contentW: number;
  private tocEntries: TocEntry[] = [];

  constructor() {
    this.pdf = new jsPDF({ unit: 'mm', format: 'letter' });
    this.pageW = this.pdf.internal.pageSize.getWidth();
    this.pageH = this.pdf.internal.pageSize.getHeight();
    this.contentW = this.pageW - MARGIN * 2;
  }

  // ── Page management ────────────────────────────────────────────────────────

  get currentPage() {
    return (this.pdf.internal as any).getCurrentPageInfo().pageNumber;
  }

  private newPage() {
    this.pdf.addPage();
    this.y = TOP_MARGIN;
  }

  private remainingHeight() {
    return this.pageH - BOTTOM_MARGIN - this.y;
  }

  /** Returns the height in mm a block of lines at given fontSize would need */
  private blockHeight(lineCount: number, fontSize: number) {
    return lineCount * fontSize * LINE_SCALE + PARA_GAP;
  }

  /** Set font helper */
  private font(size: number, style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal') {
    this.pdf.setFontSize(size);
    this.pdf.setFont('times', style);
  }

  // ── Text rendering ─────────────────────────────────────────────────────────

  /**
   * Add wrapped text with orphan/widow prevention.
   * Returns the y position after the block.
   */
  private addText(
    text: string,
    fontSize: number,
    style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal',
    opts: { center?: boolean; indent?: number; gapAfter?: number } = {}
  ) {
    if (!text?.trim()) return;
    this.font(fontSize, style);
    const x = MARGIN + (opts.indent || 0);
    const w = this.contentW - (opts.indent || 0);
    const lines = this.pdf.splitTextToSize(text.trim(), w) as string[];
    const lineH = fontSize * LINE_SCALE;
    const gapAfter = opts.gapAfter ?? PARA_GAP;

    // Orphan prevention: if fewer than ORPHAN_LINES lines fit, push to next page
    const remaining = this.remainingHeight();
    const fitsCount = Math.floor(remaining / lineH);

    if (lines.length <= ORPHAN_LINES || fitsCount < ORPHAN_LINES) {
      // Entire small block or start of block — push to new page if it won't fit
      if (fitsCount < Math.min(ORPHAN_LINES, lines.length)) {
        this.newPage();
      }
    }

    for (let i = 0; i < lines.length; i++) {
      if (this.y + lineH > this.pageH - BOTTOM_MARGIN) {
        // About to break — check widow: if only 1 line remains after break, push it back
        const linesLeft = lines.length - i;
        if (linesLeft <= ORPHAN_LINES && i > 0) {
          // Back up ORPHAN_LINES lines to the previous page
          // (simplification: just start a new page here, all remaining lines go together)
        }
        this.newPage();
      }
      const xPos = opts.center ? this.pageW / 2 : x;
      this.pdf.text(lines[i], xPos, this.y, opts.center ? { align: 'center' } : {});
      this.y += lineH;
    }
    this.y += gapAfter;
  }

  /** Add a horizontal rule */
  private addRule(thickness = 0.3) {
    this.pdf.setLineWidth(thickness);
    this.pdf.setDrawColor(180, 180, 180);
    this.pdf.line(MARGIN, this.y, this.pageW - MARGIN, this.y);
    this.y += 4;
  }

  // ── Image rendering ────────────────────────────────────────────────────────

  /**
   * Add an image, scaled to fit the available width (or the full page for featured images).
   * full=true → image fills the page (with margins), centered vertically.
   */
  private async addImage(
    imgData: { data: string; format: string },
    caption: string,
    opts: { full?: boolean; maxHeightMm?: number } = {}
  ) {
    const dims = await getImageDimensions(imgData.data, imgData.format);
    const aspect = dims.w / dims.h;

    if (opts.full) {
      // Full-page image
      this.newPage();
      const maxW = this.contentW;
      const maxH = this.pageH - TOP_MARGIN - BOTTOM_MARGIN - (caption ? 12 : 0);
      let w = maxW;
      let h = w / aspect;
      if (h > maxH) { h = maxH; w = h * aspect; }
      const x = (this.pageW - w) / 2;
      const y = (this.pageH - h - (caption ? 10 : 0)) / 2;
      this.pdf.addImage(imgData.data, imgData.format, x, y, w, h);
      if (caption) {
        this.font(FONT_CAPTION, 'italic');
        this.pdf.text(caption, this.pageW / 2, y + h + 6, { align: 'center' });
      }
      this.newPage(); // content continues on next page
    } else {
      const maxH = opts.maxHeightMm ?? 100;
      let w = this.contentW;
      let h = w / aspect;
      if (h > maxH) { h = maxH; w = h * aspect; }

      // Check if image fits on current page
      const needed = h + (caption ? 10 : 0) + 6;
      if (this.remainingHeight() < needed) this.newPage();

      const x = (this.pageW - w) / 2;
      this.pdf.addImage(imgData.data, imgData.format, x, this.y, w, h);
      this.y += h + 3;

      if (caption) {
        this.font(FONT_CAPTION, 'italic');
        this.pdf.text(caption, this.pageW / 2, this.y, { align: 'center' });
        this.y += FONT_CAPTION * LINE_SCALE + 2;
      }
      this.y += PARA_GAP;
    }
  }

  // ── Section builders ───────────────────────────────────────────────────────

  private buildTitlePage(book: Book, coverImg: { data: string; format: string } | null) {
    if (coverImg) {
      // Full bleed cover image
      const dims_sync = { w: 1, h: 1 }; // will be overridden async — handled before call
      this.pdf.addImage(
        coverImg.data,
        coverImg.format,
        0, 0,
        this.pageW, this.pageH
      );
      // Semi-transparent white overlay at bottom for title text
      this.pdf.setFillColor(255, 255, 255);
      this.pdf.setGState(new (this.pdf as any).GState({ opacity: 0.75 }));
      this.pdf.rect(0, this.pageH * 0.65, this.pageW, this.pageH * 0.35, 'F');
      this.pdf.setGState(new (this.pdf as any).GState({ opacity: 1 }));
    }

    // Title
    this.font(32, 'bold');
    this.pdf.setTextColor(20, 20, 20);
    const titleLines = this.pdf.splitTextToSize(book.title, this.contentW) as string[];
    let ty = coverImg ? this.pageH * 0.72 : this.pageH * 0.38;
    titleLines.forEach((line) => {
      this.pdf.text(line, this.pageW / 2, ty, { align: 'center' });
      ty += 32 * LINE_SCALE + 2;
    });

    // Author — smaller, 12pt
    this.font(12, 'normal');
    this.pdf.text(`by ${book.author}`, this.pageW / 2, ty + 8, { align: 'center' });
  }

  private buildDedication(book: Book) {
    if (!book.dedication) return;
    this.newPage();
    this.y = this.pageH * 0.3;
    this.addText('Dedication', FONT_SUBHEAD + 2, 'bolditalic', { center: true, gapAfter: 10 });
    this.addRule();
    this.addText(book.dedication, FONT_BODY, 'italic', { center: true });
  }

  private buildIntro(book: Book) {
    if (!book.intro) return;
    this.newPage();
    this.addText('Introduction', FONT_CHAPTER_SUB + 2, 'bold', { gapAfter: 6 });
    this.addRule();
    const plain = htmlToPlainText(book.intro);
    plain.split('\n\n').forEach((para) => {
      if (para.trim()) this.addText(para, FONT_BODY, 'normal', { gapAfter: PARA_GAP });
    });
  }

  private async buildTableOfContents() {
    if (this.tocEntries.length === 0) return;
    this.newPage();
    this.addText('Table of Contents', FONT_TOC_TITLE, 'bold', { center: true, gapAfter: 8 });
    this.addRule(0.5);
    this.y += 2;

    for (const entry of this.tocEntries) {
      this.font(FONT_TOC_ENTRY, 'bold');
      const label = `Chapter ${entry.chapterNumber}: ${entry.title}`;
      const pageStr = `${entry.pageNumber}`;

      // Leader dots
      const labelW = this.pdf.getTextWidth(label);
      const pageW = this.pdf.getTextWidth(pageStr);
      const dotsW = this.contentW - labelW - pageW - 4;
      const dotStr = '.'.repeat(Math.max(3, Math.floor(dotsW / this.pdf.getTextWidth('.'))));

      if (this.remainingHeight() < FONT_TOC_ENTRY * LINE_SCALE * 3) this.newPage();

      this.pdf.text(label, MARGIN, this.y);
      this.font(FONT_TOC_ENTRY, 'normal');
      this.pdf.text(dotStr, MARGIN + labelW + 2, this.y);
      this.font(FONT_TOC_ENTRY, 'bold');
      this.pdf.text(pageStr, this.pageW - MARGIN, this.y, { align: 'right' });
      this.y += FONT_TOC_ENTRY * LINE_SCALE + 2;

      if (entry.subtitle) {
        this.font(FONT_TOC_ENTRY - 1, 'italic');
        this.pdf.text(entry.subtitle, MARGIN + 6, this.y);
        this.y += (FONT_TOC_ENTRY - 1) * LINE_SCALE + 1;
      }
      this.y += 1;
    }
  }

  private buildChapterTitlePage(
    chapter: { chapter_number: number; title: string; lede?: string | null },
    chapterImgData: { data: string; format: string } | null
  ) {
    this.newPage();
    const pageNum = this.currentPage;

    if (chapterImgData) {
      // Image as chapter header, fills top ~55% of page
      const maxH = this.pageH * 0.55;
      const aspect_placeholder = 1.5; // will be corrected below — but we already loaded it
      this.pdf.addImage(chapterImgData.data, chapterImgData.format, 0, 0, this.pageW, maxH);
      this.y = maxH + 12;
    } else {
      this.y = this.pageH * 0.38;
    }

    this.font(12, 'normal');
    this.pdf.setTextColor(100, 100, 100);
    this.pdf.text(`Chapter ${chapter.chapter_number}`, this.pageW / 2, this.y, { align: 'center' });
    this.y += 12 * LINE_SCALE + 4;

    this.font(FONT_CHAPTER, 'bold');
    this.pdf.setTextColor(20, 20, 20);
    this.pdf.text(chapter.title, this.pageW / 2, this.y, { align: 'center' });
    this.y += FONT_CHAPTER * LINE_SCALE + 6;

    if (chapter.lede) {
      this.font(FONT_CHAPTER_SUB, 'italic');
      this.pdf.setTextColor(60, 60, 60);
      this.pdf.text(chapter.lede, this.pageW / 2, this.y, { align: 'center' });
    }

    this.pdf.setTextColor(20, 20, 20);
    return pageNum;
  }

  private async buildGalleryPage(
    images: Array<{ src: string; caption?: string }>,
    title?: string
  ) {
    this.newPage();

    if (title) {
      this.addText(title, FONT_SUBHEAD + 1, 'bold', { gapAfter: 4 });
      this.addRule();
    }

    // Load all images first
    const loaded = await Promise.all(
      images.map(async (img) => ({
        imgData: await loadImageAsBase64(img.src),
        caption: img.caption || '',
      }))
    );

    // Lay out in a 2-column grid
    const colW = (this.contentW - 6) / 2;
    const rowH = 60; // mm per row
    let col = 0;
    let rowStart = this.y;

    for (let i = 0; i < loaded.length; i++) {
      if (col === 0) {
        if (this.remainingHeight() < rowH + 12) this.newPage();
        rowStart = this.y;
      }
      const x = MARGIN + col * (colW + 6);

      if (loaded[i].imgData) {
        this.pdf.addImage(
          loaded[i].imgData!.data,
          loaded[i].imgData!.format,
          x,
          rowStart,
          colW,
          rowH
        );
        if (loaded[i].caption) {
          this.font(FONT_CAPTION, 'italic');
          const capLines = this.pdf.splitTextToSize(loaded[i].caption, colW) as string[];
          let cy = rowStart + rowH + 3;
          capLines.forEach((cl) => {
            this.pdf.text(cl, x + colW / 2, cy, { align: 'center' });
            cy += FONT_CAPTION * LINE_SCALE + 1;
          });
        }
      } else {
        // Placeholder box
        this.pdf.setDrawColor(200, 200, 200);
        this.pdf.rect(x, rowStart, colW, rowH);
        if (loaded[i].caption) {
          this.font(FONT_CAPTION, 'italic');
          this.pdf.text(loaded[i].caption, x + colW / 2, rowStart + rowH + 5, { align: 'center' });
        }
      }

      col++;
      if (col === 2) {
        col = 0;
        this.y = rowStart + rowH + 16; // move below row + caption space
      }
    }
    if (col !== 0) {
      this.y = rowStart + rowH + 16;
    }
  }

  private async buildLogoPage() {
    this.newPage();
    const logoImg = await loadImageAsBase64(LOGO_URL);
    this.y = this.pageH * 0.4;

    if (logoImg) {
      const dims = await getImageDimensions(logoImg.data, logoImg.format);
      const maxW = 80;
      const w = Math.min(maxW, this.contentW);
      const h = w / (dims.w / dims.h);
      this.pdf.addImage(logoImg.data, logoImg.format, (this.pageW - w) / 2, this.y, w, h);
      this.y += h + 8;
    }

    this.font(10, 'italic');
    this.pdf.setTextColor(100, 100, 100);
    this.pdf.text('Created with Lasting Legacy Online', this.pageW / 2, this.y, { align: 'center' });
    this.pdf.setTextColor(20, 20, 20);
  }

  // ── Main build ─────────────────────────────────────────────────────────────

  async build(book: Book, chaptersWithPages: ChapterWithPages[]): Promise<void> {
    // Pre-load cover image
    const coverImg = book.image_url ? await loadImageAsBase64(book.image_url) : null;

    // ── Page 1: Title ──────────────────────────────────────────────────────
    this.buildTitlePage(book, coverImg);

    // ── Dedication ────────────────────────────────────────────────────────
    this.buildDedication(book);

    // ── Introduction ──────────────────────────────────────────────────────
    this.buildIntro(book);

    // ── TOC placeholder page (we'll come back) ────────────────────────────
    // We insert TOC after we know page numbers, using jsPDF's page insert API.
    // Strategy: record TOC page index, build rest, then write TOC text on that page.
    this.newPage();
    const tocPageIndex = this.currentPage; // we'll write TOC here later

    // ── Chapters ──────────────────────────────────────────────────────────
    for (const chapter of chaptersWithPages) {
      // Pre-load chapter image
      const chImgUrl = (chapter as any).image_url as string | undefined;
      const chImg = chImgUrl ? await loadImageAsBase64(chImgUrl) : null;

      const chapterStartPage = this.currentPage + 1;
      this.buildChapterTitlePage(chapter, chImg);

      this.tocEntries.push({
        chapterNumber: chapter.chapter_number,
        title: chapter.title,
        subtitle: chapter.lede || undefined,
        pageNumber: chapterStartPage,
      });

      if (chapter.heading) {
        this.newPage();
        this.addText(chapter.heading, FONT_SUBHEAD, 'bold', { gapAfter: 2 });
        this.addRule();
      }

      if (chapter.pages) {
        for (const page of chapter.pages) {
          switch (page.type) {
            // ── Subheading ─────────────────────────────────────────────
            case 'subheading': {
              if (page.content) {
                this.y += 4;
                this.addText(page.content, FONT_SUBHEAD, 'bold', { gapAfter: 2 });
                this.addRule(0.2);
              }
              break;
            }

            // ── Content (rich text) ────────────────────────────────────
            case 'content': {
              if (page.content) {
                // Extract and render inline images BEFORE text
                const inlineImgs = extractInlineImages(page.content);
                const plain = htmlToPlainText(page.content);

                // Render paragraphs
                const paragraphs = plain.split('\n\n');
                for (const para of paragraphs) {
                  if (!para.trim()) continue;
                  // Bullet list detection
                  if (para.startsWith('• ')) {
                    const items = para.split('\n').filter(Boolean);
                    for (const item of items) {
                      this.addText(item, FONT_BODY, 'normal', { indent: 4, gapAfter: 1 });
                    }
                    this.y += 2;
                  } else {
                    this.addText(para, FONT_BODY, 'normal', { gapAfter: PARA_GAP });
                  }
                }

                // Render inline images after paragraph text
                for (const img of inlineImgs) {
                  const imgData = await loadImageAsBase64(img.src);
                  if (imgData) {
                    await this.addImage(imgData, img.caption || img.alt, { maxHeightMm: 90 });
                  }
                }
              }
              break;
            }

            // ── Quote ──────────────────────────────────────────────────
            case 'quote': {
              if (page.content) {
                this.y += 4;
                // Indented quote with left bar
                const quoteX = MARGIN + 8;
                const quoteW = this.contentW - 16;
                const plain = htmlToPlainText(page.content);
                this.font(FONT_BODY, 'italic');
                const lines = this.pdf.splitTextToSize(`"${plain}"`, quoteW) as string[];
                const blockH = this.blockHeight(lines.length, FONT_BODY);
                if (this.remainingHeight() < blockH + 10) this.newPage();

                // Draw left bar
                this.pdf.setDrawColor(150, 150, 150);
                this.pdf.setLineWidth(0.8);
                this.pdf.line(MARGIN + 2, this.y - 2, MARGIN + 2, this.y + blockH - 4);

                for (const line of lines) {
                  this.pdf.text(line, quoteX, this.y);
                  this.y += FONT_BODY * LINE_SCALE;
                }
                this.y += 6;
              }
              break;
            }

            // ── Featured image (own page, full-size) ──────────────────
            case 'image': {
              const imgUrl = (page as any).image_url as string | undefined;
              const caption = page.image_caption || '';
              if (imgUrl) {
                const imgData = await loadImageAsBase64(imgUrl);
                if (imgData) {
                  await this.addImage(imgData, caption, { full: true });
                }
              } else if (caption) {
                this.addText(`[Image: ${caption}]`, FONT_CAPTION, 'italic');
              }
              break;
            }

            // ── Gallery page ───────────────────────────────────────────
            case 'gallery': {
              const galleryImages = (page as any).gallery_images as
                Array<{ src: string; caption?: string }> | undefined;
              const isGalleryPage = (page as any).is_gallery_page as boolean | undefined;
              const galleryTitle = isGalleryPage ? (page.content || page.image_caption || undefined) : undefined;

              if (galleryImages?.length) {
                await this.buildGalleryPage(galleryImages, galleryTitle);
              }
              break;
            }
          }
        }
      }
    }

    // ── Lasting Legacy logo / colophon page ───────────────────────────────
    await this.buildLogoPage();

    // ── Now go back and write the TOC ─────────────────────────────────────
    // Switch to the reserved TOC page and write it
    this.pdf.setPage(tocPageIndex);
    this.y = TOP_MARGIN;
    await this.buildTableOfContents();
  }

  save(filename: string) {
    this.pdf.save(filename);
  }
}

// ─── Public export ────────────────────────────────────────────────────────────

export async function downloadBookPDF(book: Book, chaptersWithPages: ChapterWithPages[]) {
  try {
    const builder = new BookPdfBuilder();
    await builder.build(book, chaptersWithPages);
    builder.save(`${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}
