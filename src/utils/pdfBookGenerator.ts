import jsPDF from 'jspdf';
import { Book, Page, GalleryItem } from '../lib/supabase';
import { ChapterWithFullData } from './bookDataFetcher';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Strip all HTML tags and decode basic entities to plain text. */
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

/** Fetch a remote image and return a base64 data-URL, or null on failure. */
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

/** Return natural image dimensions capped to maxW × maxH, preserving aspect ratio. */
function fitDimensions(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  const ratio = Math.min(maxW / naturalW, maxH / naturalH, 1);
  return { w: naturalW * ratio, h: naturalH * ratio };
}

/** Resolve natural dimensions from a base64 data-URL. */
async function imageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 400, h: 300 });
    img.src = dataUrl;
  });
}

// ─── main export ────────────────────────────────────────────────────────────

export async function downloadBookPDF(
  book: Book,
  chaptersWithPages: ChapterWithFullData[]
) {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const PW = pdf.internal.pageSize.getWidth();   // 612 pt
  const PH = pdf.internal.pageSize.getHeight();  // 792 pt
  const ML = 60;
  const MR = 60;
  const MT = 60;
  const MB = 60;
  const TW = PW - ML - MR; // 492 pt

  let y = MT;

  const newPage = () => { pdf.addPage(); y = MT; };
  const ensureSpace = (needed: number) => { if (y + needed > PH - MB) newPage(); };
  const gap = (pts: number) => { y += pts; if (y > PH - MB) newPage(); };

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
      const lineH = size * 1.4;
      ensureSpace(lines.length * lineH + 6);
      lines.forEach((line) => {
        pdf.text(line, centerOnPage ? PW / 2 : ML, y, centerOnPage ? { align: 'center' } : undefined);
        y += lineH;
      });
      y += 6;
    });
  };

  const addImage = async (url: string, caption?: string | null, maxH = 280): Promise<void> => {
    if (!url) return;
    const data = await fetchBase64(url);
    if (!data) return;
    const nat = await imageDimensions(data);
    const { w, h } = fitDimensions(nat.w, nat.h, TW, maxH);
    const captionH = caption ? 20 : 0;
    ensureSpace(h + captionH + 16);
    const x = ML + (TW - w) / 2;
    const fmt = data.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    pdf.addImage(data, fmt, x, y, w, h);
    y += h + 4;
    if (caption) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100, 100, 100);
      const capLines: string[] = pdf.splitTextToSize(caption, TW);
      capLines.forEach((line) => { pdf.text(line, PW / 2, y, { align: 'center' }); y += 12; });
    }
    y += 12;
  };

  const addDivider = () => {
    ensureSpace(24);
    pdf.setDrawColor(180, 160, 130);
    pdf.setLineWidth(0.5);
    pdf.line(ML + TW * 0.2, y + 6, ML + TW * 0.8, y + 6);
    y += 20;
  };

  // ── TITLE PAGE ──────────────────────────────────────────────────────────────
  if (book.image_url) {
    await addImage(book.image_url, null, 320);
    gap(16);
  } else {
    y = 160;
  }
  addText(book.title, 28, 'bold', [30, 30, 30], true);
  gap(8);
  addText(`by ${book.author}`, 14, 'normal', [100, 80, 60], true);
  if (book.date_published) { gap(6); addText(book.date_published, 11, 'italic', [130, 110, 90], true); }

  // ── DEDICATION ──────────────────────────────────────────────────────────────
  if (book.dedication) {
    newPage(); y = PH * 0.3;
    addText('Dedication', 16, 'bold', [80, 60, 40], true);
    gap(20);
    addText(book.dedication, 12, 'italic', [70, 70, 70], true);
  }

  // ── INTRODUCTION ────────────────────────────────────────────────────────────
  if (book.intro) {
    newPage();
    addText('Introduction', 18, 'bold', [30, 30, 30]);
    gap(8);
    if (book.intro_image_url) await addImage(book.intro_image_url, book.intro_image_caption);
    addText(book.intro, 11);
  }

  // ── CHAPTERS ────────────────────────────────────────────────────────────────
  for (const chapter of chaptersWithPages) {
    newPage();

    addText(`Chapter ${chapter.number}`, 12, 'bold', [140, 100, 60], true);
    gap(4);
    addText(chapter.title, 22, 'bold', [30, 30, 30], true);

    if (chapter.lede) { gap(10); addText(chapter.lede, 11, 'italic', [100, 80, 60]); }
    if (chapter.image_url) { gap(12); await addImage(chapter.image_url, null, 260); }
    gap(16);

    // Gallery lookup maps
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

    // Pages
    for (const page of chapter.pages ?? []) {
      if (page.is_deleted) continue;

      // Section heading
      if (page.subtitle?.trim()) {
        gap(10);
        addText(page.subtitle, 14, 'bold', [60, 40, 20]);
        gap(4);
      }

      // Header image
      if (page.image_url) await addImage(page.image_url, page.image_caption, 260);

      // Body content
      if (page.content?.trim()) addText(page.content, 11);

      // Pull quote
      if (page.quote?.trim()) {
        ensureSpace(60);
        gap(8);
        pdf.setDrawColor(180, 140, 80);
        pdf.setLineWidth(2.5);
        pdf.line(ML, y, ML, y + 40);
        pdf.setLineWidth(0.5);
        const qLines: string[] = pdf.splitTextToSize(`\u201C${page.quote}\u201D`, TW - 16);
        pdf.setFontSize(12); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(60, 40, 20);
        qLines.forEach((line) => { pdf.text(line, ML + 14, y); y += 17; });
        if (page.quote_attribute) {
          gap(2);
          pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(120, 100, 80);
          pdf.text(`\u2014 ${page.quote_attribute}`, ML + 14, y); y += 14;
        }
        gap(10);
      }

      // Per-page gallery
      for (const g of galleryByPage.get(page.id) ?? []) {
        await addImage(g.image_url, g.image_caption, 220);
      }
    }

    // Floating (chapter-level) gallery
    if (floatingGallery.length > 0) {
      addDivider();
      addText('Photos', 13, 'bold', [100, 80, 60]);
      gap(8);
      for (const g of floatingGallery) await addImage(g.image_url, g.image_caption, 240);
    }
  }

  pdf.save(`${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
}
