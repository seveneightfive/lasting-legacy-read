import jsPDF from 'jspdf';
import { Book, GalleryItem } from '../lib/supabase';
import { ChapterWithFullData } from './bookDataFetcher';

// ─── Progress callback type ──────────────────────────────────────────────────
export type ProgressCallback = (pct: number) => void;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

async function fetchBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fitDimensions(nw: number, nh: number, maxW: number, maxH: number) {
  const ratio = Math.min(maxW / nw, maxH / nh, 1);
  return { w: nw * ratio, h: nh * ratio };
}

async function naturalSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 400, h: 300 });
    img.src = dataUrl;
  });
}

function imgFormat(dataUrl: string): string {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function downloadBookPDF(
  book: Book,
  chaptersWithPages: ChapterWithFullData[],
  onProgress?: ProgressCallback
) {
  // 5.5 × 8.5 inches = 396 × 612 pt
  const pdf = new jsPDF({ unit: 'pt', format: [396, 612] });

  const PW = 396;
  const PH = 612;
  const ML = 45;   // left margin
  const MR = 45;   // right margin
  const MT = 50;   // top margin
  const MB = 50;   // bottom margin
  const TW = PW - ML - MR;  // 306 pt text width
  const FOOTER_Y = PH - 22; // page number baseline

  let y = MT;
  let pageNum = 0; // we'll stamp page numbers in a second pass via jsPDF's page events

  // ── Track total image-fetch work for progress ────────────────────────────
  // Count all images upfront so we can report realistic progress
  let totalImages = 0;
  let loadedImages = 0;

  if (book.image_url) totalImages++;
  if (book.intro_image_url) totalImages++;
  for (const ch of chaptersWithPages) {
    if (ch.image_url) totalImages++;
    for (const p of ch.pages ?? []) {
      if (p.is_deleted) continue;
      if (p.image_url) totalImages++;
    }
    for (const g of ch.galleryItems ?? []) {
      totalImages++;
    }
  }

  // We split progress: 0–15% = data already fetched, 15–95% = images, 95–100% = save
  const reportProgress = (base: number) => {
    onProgress?.(Math.round(base));
  };

  reportProgress(15);

  // ── Layout primitives ────────────────────────────────────────────────────

  const currentPageNumber = () => (pdf as any).internal.getCurrentPageInfo().pageNumber as number;

  const newPage = () => {
    pdf.addPage();
    y = MT;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PH - MB) newPage();
  };

  const gap = (pts: number) => {
    y += pts;
    if (y > PH - MB) newPage();
  };

  const addText = (
    raw: string,
    size: number,
    style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal',
    color: [number, number, number] = [30, 30, 30],
    centerOnPage = false
  ) => {
    if (!raw?.trim()) return;
    const text = raw.trim().startsWith('<') ? htmlToText(raw) : raw.trim();
    if (!text) return;

    pdf.setFontSize(size);
    pdf.setFont('helvetica', style);
    pdf.setTextColor(...color);

    text.split(/\n\n+/).forEach((para) => {
      const cleaned = para.replace(/\n/g, ' ').trim();
      if (!cleaned) return;
      const lines: string[] = pdf.splitTextToSize(cleaned, TW);
      const lineH = size * 1.45;
      ensureSpace(lines.length * lineH + 8);
      lines.forEach((line) => {
        pdf.text(line, centerOnPage ? PW / 2 : ML, y,
          centerOnPage ? { align: 'center' } : undefined);
        y += lineH;
      });
      y += 6;
    });
  };

  // Returns height consumed (0 if skipped)
  const addImage = async (
    url: string,
    caption?: string | null,
    maxH = 220,
    maxW = TW
  ): Promise<number> => {
    if (!url) return 0;
    const data = await fetchBase64(url);
    loadedImages++;
    // progress: 15% base + up to 80% for images
    reportProgress(15 + Math.round((loadedImages / Math.max(totalImages, 1)) * 80));
    if (!data) return 0;

    const nat = await naturalSize(data);
    const { w, h } = fitDimensions(nat.w, nat.h, maxW, maxH);
    const captionH = caption ? 14 * 1.3 * Math.ceil(caption.length / 55) + 8 : 0;

    ensureSpace(h + captionH + 14);

    const x = ML + (TW - w) / 2;
    pdf.addImage(data, imgFormat(data), x, y, w, h);
    y += h + 4;

    if (caption) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(110, 90, 70);
      const capLines: string[] = pdf.splitTextToSize(caption, TW);
      capLines.forEach((line) => {
        pdf.text(line, PW / 2, y, { align: 'center' });
        y += 11;
      });
    }
    y += 10;
    return h + captionH + 14;
  };

  // Full-bleed image filling the entire page (for chapter image left-page)
  const addFullPageImage = async (url: string): Promise<void> => {
    if (!url) return;
    const data = await fetchBase64(url);
    loadedImages++;
    reportProgress(15 + Math.round((loadedImages / Math.max(totalImages, 1)) * 80));
    if (!data) return;

    const nat = await naturalSize(data);
    // fill the page keeping aspect ratio, cropping if necessary
    const scale = Math.max(PW / nat.w, PH / nat.h);
    const w = nat.w * scale;
    const h = nat.h * scale;
    const x = (PW - w) / 2;
    const yOff = (PH - h) / 2;
    pdf.addImage(data, imgFormat(data), x, yOff, w, h);
  };

  const addDivider = () => {
    ensureSpace(20);
    pdf.setDrawColor(180, 160, 130);
    pdf.setLineWidth(0.5);
    pdf.line(ML + TW * 0.2, y + 6, ML + TW * 0.8, y + 6);
    y += 18;
  };

  // ── Page number footer (stamped after all pages are written) ─────────────
  // We collect page numbers to stamp — jsPDF numbers pages 1-based internally
  // We skip page 1 (title page)
  const stampPageNumbers = () => {
    const total = (pdf as any).internal.getNumberOfPages() as number;
    for (let i = 2; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(150, 140, 130);
      // odd pages: right-aligned; even pages: left-aligned (book convention)
      if (i % 2 === 0) {
        pdf.text(String(i - 1), ML, FOOTER_Y);
      } else {
        pdf.text(String(i - 1), PW - MR, FOOTER_Y, { align: 'right' });
      }
    }
    // Go back to last page
    pdf.setPage(total);
  };

  // ── TITLE PAGE (page 1, no number) ─────────────────────────────────────────
  if (book.image_url) {
    await addFullPageImage(book.image_url);
    // Overlay title at bottom
    pdf.setFillColor(0, 0, 0);
    // translucent band not directly supported in jsPDF without canvas hack, so just overlay text
    y = PH - MB - 60;
    addText(book.title, 22, 'bold', [255, 255, 255], true);
    addText(`by ${book.author}`, 11, 'italic', [220, 210, 190], true);
  } else {
    y = PH * 0.35;
    addText(book.title, 26, 'bold', [30, 30, 30], true);
    gap(10);
    addText(`by ${book.author}`, 13, 'normal', [100, 80, 60], true);
    if (book.date_published) { gap(6); addText(book.date_published, 10, 'italic', [140, 120, 100], true); }
  }

  // ── DEDICATION ──────────────────────────────────────────────────────────────
  if (book.dedication) {
    newPage();
    y = PH * 0.28;
    addText('Dedication', 14, 'bold', [80, 60, 40], true);
    gap(18);
    addText(book.dedication, 11, 'italic', [70, 70, 70], true);
  }

  // ── INTRODUCTION ────────────────────────────────────────────────────────────
  if (book.intro) {
    newPage();
    addText('Introduction', 16, 'bold', [30, 30, 30]);
    gap(8);
    if (book.intro_image_url) await addImage(book.intro_image_url, book.intro_image_caption, 200);
    addText(book.intro, 10);
  }

  // ── CHAPTERS ────────────────────────────────────────────────────────────────
  for (const chapter of chaptersWithPages) {

    // ── Chapter opening spread ───────────────────────────────────────────────
    // LEFT page: full-bleed chapter image (or plain tinted page if no image)
    newPage();
    if (chapter.image_url) {
      await addFullPageImage(chapter.image_url);
    } else {
      // Warm cream background as a stand-in
      pdf.setFillColor(245, 240, 232);
      pdf.rect(0, 0, PW, PH, 'F');
      // Chapter number as large ghost text
      pdf.setFontSize(80);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(220, 210, 195);
      pdf.text(String(chapter.number), PW / 2, PH / 2 + 28, { align: 'center' });
    }

    // RIGHT page: chapter title + lede
    newPage();
    pdf.setFillColor(250, 247, 242);
    pdf.rect(0, 0, PW, PH, 'F');
    y = PH * 0.32;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(160, 120, 80);
    pdf.text(`CHAPTER ${chapter.number}`, PW / 2, y, { align: 'center' });
    y += 22;

    addText(chapter.title, 20, 'bold', [30, 20, 10], true);

    if (chapter.lede) {
      gap(14);
      // Decorative rule
      pdf.setDrawColor(180, 140, 80);
      pdf.setLineWidth(0.75);
      pdf.line(PW / 2 - 24, y, PW / 2 + 24, y);
      y += 16;
      addText(chapter.lede, 10, 'italic', [100, 80, 60], true);
    }

    // Content pages start fresh
    newPage();
    y = MT;

    // ── Gallery lookup maps ────────────────────────────────────────────────
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

    // ── Pages ────────────────────────────────────────────────────────────────
    for (const page of chapter.pages ?? []) {
      if (page.is_deleted) continue;

      // ── Gallery page: dedicate the whole page to its images ──────────────
      if (page.gallery_page) {
        const imgs = galleryByPage.get(page.id) ?? [];
        if (imgs.length > 0) {
          newPage();
          if (page.subtitle?.trim()) {
            addText(page.subtitle, 13, 'bold', [60, 40, 20], true);
            gap(8);
          }
          for (const g of imgs) {
            await addImage(g.image_url, g.image_caption, 220);
          }
        }
        continue; // don't render content below for gallery pages
      }

      // Section heading
      if (page.subtitle?.trim()) {
        gap(10);
        addText(page.subtitle, 13, 'bold', [55, 35, 15]);
        gap(4);
      }

      // Inline header image
      if (page.image_url) {
        await addImage(page.image_url, page.image_caption, 200);
      }

      // Body content
      if (page.content?.trim()) {
        addText(page.content, 10);
      }

      // Pull quote
      if (page.quote?.trim()) {
        ensureSpace(55);
        gap(8);
        const barTop = y;
        const qLines: string[] = pdf.splitTextToSize(`\u201C${page.quote}\u201D`, TW - 14);
        const barH = qLines.length * 16 + (page.quote_attribute ? 18 : 0) + 6;
        pdf.setDrawColor(190, 150, 90);
        pdf.setLineWidth(2);
        pdf.line(ML, barTop, ML, barTop + barH);
        pdf.setLineWidth(0.5);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(55, 35, 15);
        qLines.forEach((line) => { pdf.text(line, ML + 12, y); y += 16; });
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

      // Inline gallery images for this page
      const pageGallery = galleryByPage.get(page.id) ?? [];
      for (const g of pageGallery) {
        await addImage(g.image_url, g.image_caption, 200);
      }
    }

    // ── Floating chapter-level gallery ────────────────────────────────────
    if (floatingGallery.length > 0) {
      addDivider();
      addText('Photos', 11, 'bold', [100, 80, 60]);
      gap(6);
      for (const g of floatingGallery) {
        await addImage(g.image_url, g.image_caption, 210);
      }
    }
  }

  // ── Stamp page numbers on every page except the title page ────────────────
  stampPageNumbers();

  reportProgress(98);

  // ── Save ──────────────────────────────────────────────────────────────────
  const filename = `${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
  pdf.save(filename);

  reportProgress(100);
}
