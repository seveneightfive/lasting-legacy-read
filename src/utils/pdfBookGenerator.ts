import jsPDF from 'jspdf';
import { Book, GalleryItem } from '../lib/supabase';
import { ChapterWithFullData } from './bookDataFetcher';

export type ProgressCallback = (pct: number) => void;

// ─── Image loading via canvas (bypasses CORS that blocks fetch()) ─────────────

function loadImageViaCanvas(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      // Try again without crossOrigin (some CDNs reject the header)
      const img2 = new Image();
      img2.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img2.naturalWidth;
          canvas.height = img2.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img2, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
          resolve(null);
        }
      };
      img2.onerror = () => resolve(null);
      img2.src = url;
    };
    img.src = url;
  });
}

function fitDimensions(nw: number, nh: number, maxW: number, maxH: number) {
  const ratio = Math.min(maxW / nw, maxH / nh, 1);
  return { w: Math.round(nw * ratio), h: Math.round(nh * ratio) };
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Extract all <figure> blocks from HTML content, returning their images+captions
// and the HTML with figures stripped (so we don't double-render them as text)
interface ExtractedFigure {
  srcs: string[];
  caption: string;
}

function extractFigures(html: string): { text: string; figures: ExtractedFigure[] } {
  const figures: ExtractedFigure[] = [];
  const figureRegex = /<figure[^>]*>([\s\S]*?)<\/figure>/gi;
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  const captionRegex = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i;

  let match;
  while ((match = figureRegex.exec(html)) !== null) {
    const figHtml = match[1];
    const srcs: string[] = [];
    let imgMatch;
    while ((imgMatch = imgRegex.exec(figHtml)) !== null) {
      srcs.push(imgMatch[1]);
    }
    const capMatch = captionRegex.exec(figHtml);
    const caption = capMatch ? htmlToText(capMatch[1]) : '';
    if (srcs.length > 0) figures.push({ srcs, caption });
  }

  const text = html.replace(figureRegex, '');
  return { text, figures };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function downloadBookPDF(
  book: Book,
  chaptersWithPages: ChapterWithFullData[],
  onProgress?: ProgressCallback
) {
  // 5.5 × 8.5 inches = 396 × 612 pt
  const pdf = new jsPDF({ unit: 'pt', format: [396, 612] });

  const PW = 396;
  const PH = 612;
  const ML = 48;
  const MR = 48;
  const MT = 52;
  const MB = 52;
  const TW = PW - ML - MR;        // 300 pt
  const FOOTER_Y = PH - 20;

  let y = MT;

  // ── Progress tracking ────────────────────────────────────────────────────
  let totalImages = 0;
  let loadedImages = 0;

  if (book.image_url) totalImages++;
  if (book.intro_image_url) totalImages++;
  for (const ch of chaptersWithPages) {
    if (ch.image_url) totalImages++;
    for (const p of ch.pages ?? []) {
      if (p.is_deleted) continue;
      if (p.image_url) totalImages++;
      // Count figures inside HTML content
      if (p.content?.includes('<figure')) {
        const matches = p.content.match(/<figure/gi);
        if (matches) totalImages += matches.length;
      }
    }
    totalImages += (ch.galleryItems ?? []).length;
  }

  const report = (pct: number) => onProgress?.(Math.round(pct));
  report(15);

  // ── Layout primitives ────────────────────────────────────────────────────

  const newPage = () => { pdf.addPage(); y = MT; };
  const ensureSpace = (h: number) => { if (y + h > PH - MB) newPage(); };
  const gap = (pts: number) => { y += pts; if (y > PH - MB) newPage(); };

  const addText = (
    raw: string,
    size: number,
    style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal',
    color: [number, number, number] = [30, 30, 30],
    center = false,
    font = 'helvetica'
  ) => {
    if (!raw?.trim()) return;
    const text = raw.trim().startsWith('<') ? htmlToText(raw) : raw.trim();
    if (!text) return;
    pdf.setFontSize(size);
    pdf.setFont(font, style);
    pdf.setTextColor(...color);
    text.split(/\n\n+/).forEach((para) => {
      const cleaned = para.replace(/\n/g, ' ').trim();
      if (!cleaned) return;
      const lines: string[] = pdf.splitTextToSize(cleaned, TW);
      const lineH = size * 1.5;
      ensureSpace(lines.length * lineH + 8);
      lines.forEach((line) => {
        pdf.text(line, center ? PW / 2 : ML, y, center ? { align: 'center' } : undefined);
        y += lineH;
      });
      y += 5;
    });
  };

  // Embed one image URL. Returns false if it failed.
  const embedImage = async (
    url: string,
    caption: string | null | undefined,
    maxH: number,
    maxW = TW
  ): Promise<boolean> => {
    if (!url?.trim()) return false;
    const data = await loadImageViaCanvas(url);
    loadedImages++;
    report(15 + (loadedImages / Math.max(totalImages, 1)) * 78);
    if (!data) {
      console.warn('[PDF] Could not load image:', url);
      return false;
    }

    // Get dimensions from the data URL via an Image element
    const dims = await new Promise<{ w: number; h: number }>((res) => {
      const tmp = new Image();
      tmp.onload = () => res({ w: tmp.naturalWidth, h: tmp.naturalHeight });
      tmp.onerror = () => res({ w: 400, h: 300 });
      tmp.src = data;
    });

    const { w, h } = fitDimensions(dims.w, dims.h, maxW, maxH);
    const capH = caption
      ? Math.ceil(caption.length / 52) * 11 + 10
      : 0;

    ensureSpace(h + capH + 14);

    const x = ML + (TW - w) / 2;
    pdf.addImage(data, 'JPEG', x, y, w, h);
    y += h + 4;

    if (caption?.trim()) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(110, 90, 70);
      const capLines: string[] = pdf.splitTextToSize(caption.trim(), TW);
      capLines.forEach((line) => {
        pdf.text(line, PW / 2, y, { align: 'center' });
        y += 11;
      });
    }
    y += 10;
    return true;
  };

  // Full-page bleed image (chapter opener left page)
  const embedFullPage = async (url: string): Promise<void> => {
    if (!url?.trim()) return;
    const data = await loadImageViaCanvas(url);
    loadedImages++;
    report(15 + (loadedImages / Math.max(totalImages, 1)) * 78);
    if (!data) return;
    const dims = await new Promise<{ w: number; h: number }>((res) => {
      const tmp = new Image();
      tmp.onload = () => res({ w: tmp.naturalWidth, h: tmp.naturalHeight });
      tmp.onerror = () => res({ w: PW, h: PH });
      tmp.src = data;
    });
    const scale = Math.max(PW / dims.w, PH / dims.h);
    const w = dims.w * scale;
    const h = dims.h * scale;
    pdf.addImage(data, 'JPEG', (PW - w) / 2, (PH - h) / 2, w, h);
  };

  const addDivider = () => {
    ensureSpace(20);
    pdf.setDrawColor(180, 160, 130);
    pdf.setLineWidth(0.5);
    pdf.line(ML + TW * 0.2, y + 6, ML + TW * 0.8, y + 6);
    y += 18;
  };

  const stampPageNumbers = () => {
    const total = (pdf as any).internal.getNumberOfPages() as number;
    for (let i = 2; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(160, 150, 140);
      const label = String(i - 1);
      if (i % 2 === 0) {
        pdf.text(label, ML, FOOTER_Y);
      } else {
        pdf.text(label, PW - MR, FOOTER_Y, { align: 'right' });
      }
    }
    pdf.setPage((pdf as any).internal.getNumberOfPages());
  };

  // ── TITLE PAGE ───────────────────────────────────────────────────────────
  if (book.image_url) {
    await embedFullPage(book.image_url);
    y = PH - MB - 70;
    // Dark band behind title text
    pdf.setFillColor(0, 0, 0);
    pdf.setGState(new (pdf as any).GState({ opacity: 0.45 }));
    pdf.rect(0, y - 14, PW, 80, 'F');
    pdf.setGState(new (pdf as any).GState({ opacity: 1 }));
    addText(book.title, 22, 'bold', [255, 255, 255], true);
    addText(`by ${book.author}`, 11, 'italic', [230, 215, 195], true);
  } else {
    y = PH * 0.32;
    addText(book.title, 26, 'bold', [30, 30, 30], true);
    gap(10);
    addText(`by ${book.author}`, 13, 'normal', [100, 80, 60], true);
    if (book.date_published) { gap(6); addText(book.date_published, 10, 'italic', [140, 120, 100], true); }
  }

  // ── DEDICATION ───────────────────────────────────────────────────────────
  if (book.dedication) {
    newPage(); y = PH * 0.28;
    addText('Dedication', 14, 'bold', [80, 60, 40], true);
    gap(18);
    addText(book.dedication, 11, 'italic', [70, 70, 70], true);
  }

  // ── INTRODUCTION ─────────────────────────────────────────────────────────
  if (book.intro) {
    newPage();
    addText('Introduction', 16, 'bold', [30, 30, 30]);
    gap(8);
    if (book.intro_image_url) await embedImage(book.intro_image_url, book.intro_image_caption, 200);
    addText(book.intro, 10);
  }

  // ── CHAPTERS ─────────────────────────────────────────────────────────────
  for (const chapter of chaptersWithPages) {

    // LEFT PAGE — full-bleed chapter image or cream placeholder
    newPage();
    if (chapter.image_url) {
      await embedFullPage(chapter.image_url);
    } else {
      pdf.setFillColor(245, 240, 232);
      pdf.rect(0, 0, PW, PH, 'F');
      pdf.setFontSize(90);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(225, 215, 200);
      pdf.text(String(chapter.number), PW / 2, PH / 2 + 32, { align: 'center' });
    }

    // RIGHT PAGE — chapter title spread
    newPage();
    pdf.setFillColor(250, 247, 242);
    pdf.rect(0, 0, PW, PH, 'F');
    y = PH * 0.30;

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(160, 120, 80);
    pdf.text(`CHAPTER ${chapter.number}`, PW / 2, y, { align: 'center' });
    y += 24;

    // Chapter title in Helvetica bold (Avenir-like)
    addText(chapter.title, 20, 'bold', [30, 20, 10], true);

    if (chapter.lede) {
      gap(12);
      pdf.setDrawColor(190, 150, 80);
      pdf.setLineWidth(0.75);
      pdf.line(PW / 2 - 20, y, PW / 2 + 20, y);
      y += 16;
      addText(chapter.lede, 10, 'italic', [100, 80, 60], true);
    }

    // Body starts on a new page
    newPage();

    // ── Build gallery maps ───────────────────────────────────────────────
    const galleryByPage = new Map<number, GalleryItem[]>();
    const floatingGallery: GalleryItem[] = [];
    for (const g of chapter.galleryItems ?? []) {
      if (g.page_id) {
        const arr = galleryByPage.get(g.page_id) ?? [];
        arr.push(g);
        galleryByPage.set(g.page_id, arr);
      } else {
        floatingGallery.push(g);
      }
    }

    // ── Pages ────────────────────────────────────────────────────────────
    for (const page of chapter.pages ?? []) {
      if (page.is_deleted) continue;

      // ── GALLERY PAGE ────────────────────────────────────────────────────
      if (page.gallery_page) {
        const imgs = galleryByPage.get(page.id) ?? [];
        // Even if no page-linked gallery items, try floatingGallery too
        const allImgs = imgs.length > 0 ? imgs : floatingGallery;
        if (allImgs.length > 0) {
          newPage();
          if (page.subtitle?.trim()) {
            addText(page.subtitle, 13, 'bold', [55, 35, 15], true);
            gap(10);
          }
          for (const g of allImgs) {
            await embedImage(g.image_url, g.image_caption ?? g.image_title, 195);
          }
        }
        continue;
      }

      // ── Section heading ─────────────────────────────────────────────────
      if (page.subtitle?.trim()) {
        gap(10);
        // Bold + slightly spaced — closest to Avenir heading feel in jsPDF
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(50, 32, 14);
        pdf.setCharSpace(0.4);
        const hLines: string[] = pdf.splitTextToSize(page.subtitle.trim(), TW);
        ensureSpace(hLines.length * 18 + 8);
        hLines.forEach((l) => { pdf.text(l, ML, y); y += 18; });
        pdf.setCharSpace(0);
        gap(4);
      }

      // ── page.image_url (the dedicated image field) ──────────────────────
      if (page.image_url) {
        await embedImage(page.image_url, page.image_caption, 200);
      }

      // ── Body content ─────────────────────────────────────────────────────
      // Parse out any <figure> blocks embedded in HTML before rendering text
      if (page.content?.trim()) {
        const isHtml = page.content.trim().startsWith('<');
        if (isHtml) {
          const { text: strippedHtml, figures } = extractFigures(page.content);
          // Render prose
          addText(strippedHtml, 10);
          // Render inline figures in document order (after prose — mirrors reader behaviour)
          for (const fig of figures) {
            for (const src of fig.srcs) {
              await embedImage(src, fig.caption, 200);
            }
          }
        } else {
          addText(page.content, 10);
        }
      }

      // ── Pull quote ────────────────────────────────────────────────────────
      if (page.quote?.trim()) {
        ensureSpace(55);
        gap(8);
        const barTop = y;
        const qLines: string[] = pdf.splitTextToSize(`\u201C${page.quote}\u201D`, TW - 14);
        const barH = qLines.length * 16 + (page.quote_attribute ? 18 : 2) + 4;
        pdf.setDrawColor(190, 150, 90);
        pdf.setLineWidth(2);
        pdf.line(ML, barTop, ML, barTop + barH);
        pdf.setLineWidth(0.5);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(55, 35, 15);
        qLines.forEach((l) => { pdf.text(l, ML + 12, y); y += 16; });
        if (page.quote_attribute) {
          gap(2);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(120, 100, 80);
          pdf.text(`\u2014 ${page.quote_attribute}`, ML + 12, y);
          y += 14;
        }
        gap(10);
      }

      // ── Gallery items linked to this page ─────────────────────────────────
      for (const g of galleryByPage.get(page.id) ?? []) {
        await embedImage(g.image_url, g.image_caption ?? g.image_title, 195);
      }
    }

    // ── Floating gallery (chapter-level, no page_id) ─────────────────────
    if (floatingGallery.length > 0) {
      addDivider();
      addText('Photos', 11, 'bold', [100, 80, 60]);
      gap(6);
      for (const g of floatingGallery) {
        await embedImage(g.image_url, g.image_caption ?? g.image_title, 200);
      }
    }
  }

  // ── Page numbers ─────────────────────────────────────────────────────────
  stampPageNumbers();
  report(98);

  // ── Save ─────────────────────────────────────────────────────────────────
  pdf.save(`${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
  report(100);
}
