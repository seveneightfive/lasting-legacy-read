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
