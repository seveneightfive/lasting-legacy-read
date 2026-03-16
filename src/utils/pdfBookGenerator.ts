import jsPDF from 'jspdf';
import { marked } from 'marked';
import { BookWithFullData, ChapterWithFullData, loadImageAsBase64, getImageDimensions } from './bookDataFetcher';

const SITE_ICON_URL = 'https://ompmvmjamqekwmnjwnzt.supabase.co/storage/v1/object/public/LLO%20Branding/logo.png';

const PDF_CONFIG = {
  width: 396,
  height: 612,
  margin: 30,
  contentWidth: 336,
  pageNumberBottomMargin: 20,
  imageMaxWidth: 336,
  galleryImagesPerRow: 2,
  galleryImageSpacing: 10
};

const TYPOGRAPHY = {
  bodyFont: 'helvetica',
  titleFont: 'helvetica',
  bodySize: 10,
  titleSize: 21,
  captionSize: 8,
  bodyColor: { r: 51, g: 51, b: 51 },
  titleColor: { r: 0, g: 0, b: 0 },
  captionColor: { r: 80, g: 80, b: 80 },
  whiteColor: { r: 255, g: 255, b: 255 },
  bodyLineHeight: 1.5,
  titleLineHeight: 1.2,
  captionLineHeight: 1.4
};

interface PageTracker {
  currentPage: number;
  shouldShowPageNumber: boolean;
}

function stripHtmlTags(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function parseMarkdownToText(markdown: string): string {
  const html = marked.parse(markdown) as string;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  const paragraphs: string[] = [];
  const pElements = tmp.querySelectorAll('p');
  pElements.forEach(p => {
    const text = p.textContent || p.innerText || '';
    if (text.trim()) {
      paragraphs.push(text.trim());
    }
  });

  return paragraphs.join('\n\n');
}

function addPageNumber(pdf: jsPDF, pageNum: number) {
  pdf.setFontSize(TYPOGRAPHY.captionSize);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    pageNum.toString(),
    PDF_CONFIG.width / 2,
    PDF_CONFIG.height - PDF_CONFIG.pageNumberBottomMargin,
    { align: 'center' }
  );
  pdf.setTextColor(TYPOGRAPHY.bodyColor.r, TYPOGRAPHY.bodyColor.g, TYPOGRAPHY.bodyColor.b);
}

function wrapText(pdf: jsPDF, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(text, maxWidth);
}

function calculateImageDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  if (width > maxWidth) {
    height = (maxWidth / width) * height;
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = (maxHeight / height) * width;
    height = maxHeight;
  }

  return { width, height };
}

async function addCoverPage(
  pdf: jsPDF,
  bookData: BookWithFullData,
  tracker: PageTracker
): Promise<void> {
  try {
    if (bookData.book.image_url) {
      const coverImage = await loadImageAsBase64(bookData.book.image_url);
      const imgDimensions = await getImageDimensions(bookData.book.image_url);

      const scale = Math.max(
        PDF_CONFIG.width / imgDimensions.width,
        PDF_CONFIG.height / imgDimensions.height
      );
      const scaledWidth = imgDimensions.width * scale;
      const scaledHeight = imgDimensions.height * scale;
      const x = (PDF_CONFIG.width - scaledWidth) / 2;
      const y = (PDF_CONFIG.height - scaledHeight) / 2;

      pdf.addImage(coverImage, 'JPEG', x, y, scaledWidth, scaledHeight);

      pdf.setFillColor(0, 0, 0);
      pdf.setGState(pdf.GState({ opacity: 0.5 }));
      pdf.rect(0, 0, PDF_CONFIG.width, PDF_CONFIG.height, 'F');
      pdf.setGState(pdf.GState({ opacity: 1.0 }));
    } else {
      pdf.setFillColor(30, 41, 59);
      pdf.rect(0, 0, PDF_CONFIG.width, PDF_CONFIG.height, 'F');
    }

    const titleY = PDF_CONFIG.height * 0.7;
    pdf.setTextColor(TYPOGRAPHY.whiteColor.r, TYPOGRAPHY.whiteColor.g, TYPOGRAPHY.whiteColor.b);
    pdf.setFontSize(32);
    pdf.setFont(TYPOGRAPHY.titleFont, 'bold');

    const titleLines = wrapText(pdf, bookData.book.title, PDF_CONFIG.contentWidth);
    let currentY = titleY;
    titleLines.forEach(line => {
      pdf.text(line, PDF_CONFIG.width / 2, currentY, { align: 'center' });
      currentY += 32 * 1.1;
    });

    pdf.setFontSize(18);
    pdf.setFont(TYPOGRAPHY.bodyFont, 'normal');
    pdf.text(`by ${bookData.book.author}`, PDF_CONFIG.width / 2, currentY + 15, { align: 'center' });

    pdf.setTextColor(TYPOGRAPHY.bodyColor.r, TYPOGRAPHY.bodyColor.g, TYPOGRAPHY.bodyColor.b);
    tracker.currentPage = 1;
  } catch (error) {
    console.error('Error adding cover page:', error);
  }
}

async function addBlankPage(pdf: jsPDF, tracker: PageTracker): Promise<void> {
  pdf.addPage();
  tracker.currentPage++;
}

async function addBlankPageWithIcon(pdf: jsPDF, tracker: PageTracker): Promise<void> {
  pdf.addPage();
  tracker.currentPage++;

  try {
    const iconImage = await loadImageAsBase64(SITE_ICON_URL);
    const iconWidth = 80;
    const iconHeight = 40;
    const x = (PDF_CONFIG.width - iconWidth) / 2;
    const y = (PDF_CONFIG.height - iconHeight) / 2;

    pdf.addImage(iconImage, 'PNG', x, y, iconWidth, iconHeight);
  } catch (error) {
    console.error('Error adding icon to blank page:', error);
  }
}

async function addTitlePage(pdf: jsPDF, bookData: BookWithFullData, tracker: PageTracker): Promise<void> {
  pdf.addPage();
  tracker.currentPage++;

  const centerY = PDF_CONFIG.height / 2 - 40;

  pdf.setFontSize(28);
  pdf.setFont(TYPOGRAPHY.titleFont, 'bold');
  pdf.setTextColor(TYPOGRAPHY.titleColor.r, TYPOGRAPHY.titleColor.g, TYPOGRAPHY.titleColor.b);
  const titleLines = wrapText(pdf, bookData.book.title, PDF_CONFIG.contentWidth);
  let currentY = centerY;
  titleLines.forEach(line => {
    pdf.text(line, PDF_CONFIG.width / 2, currentY, { align: 'center' });
    currentY += 28 * 1.2;
  });

  pdf.setFontSize(14);
  pdf.setFont(TYPOGRAPHY.bodyFont, 'normal');
  pdf.text(`by ${bookData.book.author}`, PDF_CONFIG.width / 2, currentY + 20, { align: 'center' });
}

async function addDedicationPage(
  pdf: jsPDF,
  bookData: BookWithFullData,
  tracker: PageTracker
): Promise<void> {
  if (!bookData.book.dedication) return;

  pdf.addPage();
  tracker.currentPage++;

  const dedicationText = parseMarkdownToText(bookData.book.dedication);
  const pageStartY = PDF_CONFIG.height / 3;

  pdf.setFontSize(18);
  pdf.setFont(TYPOGRAPHY.titleFont, 'bold');
  pdf.setTextColor(TYPOGRAPHY.titleColor.r, TYPOGRAPHY.titleColor.g, TYPOGRAPHY.titleColor.b);
  pdf.text('Dedication', PDF_CONFIG.width / 2, pageStartY, { align: 'center' });

  pdf.setFontSize(TYPOGRAPHY.bodySize);
  pdf.setFont(TYPOGRAPHY.bodyFont, 'normal');
  pdf.setTextColor(TYPOGRAPHY.bodyColor.r, TYPOGRAPHY.bodyColor.g, TYPOGRAPHY.bodyColor.b);

  const paragraphs = dedicationText.split('\n\n');
  let y = pageStartY + 35;

  paragraphs.forEach(paragraph => {
    const lines = wrapText(pdf, paragraph, PDF_CONFIG.contentWidth - 40);
    lines.forEach(line => {
      pdf.text(line, PDF_CONFIG.width / 2, y, { align: 'center' });
      y += TYPOGRAPHY.bodySize * TYPOGRAPHY.bodyLineHeight;
    });
    y += TYPOGRAPHY.bodySize * TYPOGRAPHY.bodyLineHeight;
  });
}

async function addIntroPage(
  pdf: jsPDF,
  bookData: BookWithFullData,
  tracker: PageTracker
): Promise<void> {
  if (!bookData.book.intro) return;

  pdf.addPage();
  tracker.currentPage++;
  tracker.shouldShowPageNumber = true;

  const introText = parseMarkdownToText(bookData.book.intro);
  const pageStartY = PDF_CONFIG.height / 3;

  pdf.setFontSize(18);
  pdf.setFont(TYPOGRAPHY.titleFont, 'bold');
  pdf.setTextColor(TYPOGRAPHY.titleColor.r, TYPOGRAPHY.titleColor.g, TYPOGRAPHY.titleColor.b);
  pdf.text('Introduction', PDF_CONFIG.width / 2, pageStartY, { align: 'center' });

  pdf.setFontSize(TYPOGRAPHY.bodySize);
  pdf.setFont(TYPOGRAPHY.bodyFont, 'normal');
  pdf.setTextColor(TYPOGRAPHY.bodyColor.r, TYPOGRAPHY.bodyColor.g, TYPOGRAPHY.bodyColor.b);

  const paragraphs = introText.split('\n\n');
  let y = pageStartY + 35;

  paragraphs.forEach(paragraph => {
    const lines = wrapText(pdf, paragraph, PDF_CONFIG.contentWidth);
    lines.forEach(line => {
      if (y > PDF_CONFIG.height - 60) {
        addPageNumber(pdf, tracker.currentPage);
        pdf.addPage();
        tracker.currentPage++;
        y = PDF_CONFIG.margin;
        pdf.setFontSize(TYPOGRAPHY.bodySize);
        pdf.setFont(TYPOGRAPHY.bodyFont, 'normal');
        pdf.setTextColor(TYPOGRAPHY.bodyColor.r, TYPOGRAPHY.bodyColor.g, TYPOGRAPHY.bodyColor.b);
      }
      pdf.text(line, PDF_CONFIG.margin, y);
      y += TYPOGRAPHY.bodySize * TYPOGRAPHY.bodyLineHeight;
    });
    y += TYPOGRAPHY.bodySize * TYPOGRAPHY.bodyLineHeight;
  });

  addPageNumber(pdf, tracker.currentPage);
}

async function ensureOddPage(pdf: jsPDF, tracker: PageTracker): Promise<void> {
  if (tracker.currentPage % 2 === 0) {
    await addBlankPageWithIcon(pdf, tracker);
  }
}

async function addChapterTitlePage(
  pdf: jsPDF,
  chapter: ChapterWithFullData,
  tracker: PageTracker
): Promise<void> {
  await ensureOddPage(pdf, tracker);

  pdf.addPage();
  tracker.currentPage++;

  if (chapter.image_url) {
    try {
      const chapterImage = await loadImageAsBase64(chapter.image_url);
      const imgDimensions = await getImageDimensions(chapter.image_url);

      const scale = Math.max(
        PDF_CONFIG.width / imgDimensions.width,
        PDF_CONFIG.height / imgDimensions.height
      );
      const scaledWidth = imgDimensions.width * scale;
      const scaledHeight = imgDimensions.height * scale;
      const x = (PDF_CONFIG.width - scaledWidth) / 2;
      const y = (PDF_CONFIG.height - scaledHeight) / 2;

      pdf.addImage(chapterImage, 'JPEG', x, y, scaledWidth, scaledHeight);

      pdf.setGState(pdf.GState({ opacity: 0.4 }));
      pdf.setFillColor(0, 0, 0);
      pdf.rect(0, 0, PDF_CONFIG.width, PDF_CONFIG.height, 'F');
      pdf.setGState(pdf.GState({ opacity: 1.0 }));

      const textStartY = PDF_CONFIG.height * 0.65;
      let currentY = textStartY;

      pdf.setTextColor(TYPOGRAPHY.whiteColor.r, TYPOGRAPHY.whiteColor.g, TYPOGRAPHY.whiteColor.b);
      pdf.setFontSize(14);
      pdf.setFont(TYPOGRAPHY.bodyFont, 'normal');
      pdf.text(`Chapter ${chapter.number}`, PDF_CONFIG.width / 2, currentY, { align: 'center' });
      currentY += 20;

      pdf.setFontSize(TYPOGRAPHY.titleSize);
      pdf.setFont(TYPOGRAPHY.titleFont, 'bold');
      const titleLines = wrapText(pdf, chapter.title, PDF_CONFIG.contentWidth - 40);
      titleLines.forEach(line => {
        pdf.text(line, PDF_CONFIG.width / 2, currentY, { align: 'center' });
        currentY += TYPOGRAPHY.titleSize * TYPOGRAPHY.titleLineHeight;
      });

      if (chapter.lede) {
        currentY += 15;
        pdf.setFontSize(12);
        pdf.setFont(TYPOGRAPHY.bodyFont, 'italic');
        const ledeLines = wrapText(pdf, chapter.lede, PDF_CONFIG.contentWidth - 60);
        ledeLines.forEach(line => {
          pdf.text(line, PDF_CONFIG.width / 2, currentY, { align: 'center' });
          currentY += 12 * 1.4;
        });
      }
    } catch (error) {
      console.error('Error adding chapter image:', error);
      addChapterTitlePageWithoutImage(pdf, chapter);
    }
  } else {
    addChapterTitlePageWithoutImage(pdf, chapter);
  }

  pdf.setTextColor(TYPOGRAPHY.bodyColor.r, TYPOGRAPHY.bodyColor.g, TYPOGRAPHY.bodyColor.b);
}

function addChapterTitlePageWithoutImage(pdf: jsPDF, chapter: ChapterWithFullData): void {
  const currentY = PDF_CONFIG.height * 0.4;

  pdf.setFontSize(14);
  pdf.setFont(TYPOGRAPHY.bodyFont, 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Chapter ${chapter.number}`, PDF_CONFIG.width / 2, currentY, { align: 'center' });

  pdf.setFontSize(TYPOGRAPHY.titleSize);
  pdf.setFont(TYPOGRAPHY.titleFont, 'bold');
  pdf.setTextColor(TYPOGRAPHY.titleColor.r, TYPOGRAPHY.titleColor.g, TYPOGRAPHY.titleColor.b);
  const titleLines = wrapText(pdf, chapter.title, PDF_CONFIG.contentWidth);
  let textY = currentY + 25;
  titleLines.forEach(line => {
    pdf.text(line, PDF_CONFIG.width / 2, textY, { align: 'center' });
    textY += TYPOGRAPHY.titleSize * TYPOGRAPHY.titleLineHeight;
  });

  if (chapter.lede) {
    textY += 15;
    pdf.setFontSize(12);
    pdf.setFont(TYPOGRAPHY.bodyFont, 'italic');
    pdf.setTextColor(60, 60, 60);
    const ledeLines = wrapText(pdf, chapter.lede, PDF_CONFIG.contentWidth - 40);
    ledeLines.forEach(line => {
      pdf.text(line, PDF_CONFIG.width / 2, textY, { align: 'center' });
      textY += 12 * 1.4;
    });
  }
}

async function addChapterContent(
  pdf: jsPDF,
  chapter: ChapterWithFullData,
  tracker: PageTracker
): Promise<void> {
  for (const page of chapter.pages) {
    pdf.addPage();
    tracker.currentPage++;
    const pageStartY = PDF_CONFIG.height / 3;
    let y = pageStartY;

    if (page.image_url && page.image_caption) {
      try {
        const pageImage = await loadImageAsBase64(page.image_url);
        const imgDimensions = await getImageDimensions(page.image_url);

        const maxHeight = PDF_CONFIG.height - pageStartY - 100;
        const dims = calculateImageDimensions(
          imgDimensions.width,
          imgDimensions.height,
          PDF_CONFIG.imageMaxWidth,
          maxHeight
        );

        const x = (PDF_CONFIG.width - dims.width) / 2;
        pdf.addImage(pageImage, 'JPEG', x, y, dims.width, dims.height);
        y += dims.height + 12;

        pdf.setFontSize(TYPOGRAPHY.captionSize);
        pdf.setFont(TYPOGRAPHY.bodyFont, 'italic');
        pdf.setTextColor(TYPOGRAPHY.captionColor.r, TYPOGRAPHY.captionColor.g, TYPOGRAPHY.captionColor.b);
        const captionLines = wrapText(pdf, page.image_caption, PDF_CONFIG.contentWidth);
        captionLines.forEach(line => {
          pdf.text(line, PDF_CONFIG.width / 2, y, { align: 'center' });
          y += TYPOGRAPHY.captionSize * TYPOGRAPHY.captionLineHeight;
        });
        pdf.setTextColor(TYPOGRAPHY.bodyColor.r, TYPOGRAPHY.bodyColor.g, TYPOGRAPHY.bodyColor.b);

        addPageNumber(pdf, tracker.currentPage);

        pdf.addPage();
        tracker.currentPage++;
        y = pageStartY;
      } catch (error) {
        console.error('Error adding page image:', error);
      }
    }

    if (page.subtitle) {
      pdf.setFontSize(16);
      pdf.setFont(TYPOGRAPHY.titleFont, 'bold');
      pdf.setTextColor(TYPOGRAPHY.titleColor.r, TYPOGRAPHY.titleColor.g, TYPOGRAPHY.titleColor.b);
      const subtitleLines = wrapText(pdf, page.subtitle, PDF_CONFIG.contentWidth);
      subtitleLines.forEach(line => {
        if (y > PDF_CONFIG.height - 60) {
          addPageNumber(pdf, tracker.currentPage);
          pdf.addPage();
          tracker.currentPage++;
          y = PDF_CONFIG.margin;
          pdf.setFontSize(16);
          pdf.setFont(TYPOGRAPHY.titleFont, 'bold');
          pdf.setTextColor(TYPOGRAPHY.titleColor.r, TYPOGRAPHY.titleColor.g, TYPOGRAPHY.titleColor.b);
        }
        pdf.text(line, PDF_CONFIG.margin, y);
        y += 16 * 1.3;
      });
      y += 8;
    }

    if (page.quote) {
      const quoteText = parseMarkdownToText(page.quote);
      const paragraphs = quoteText.split('\n\n');

      paragraphs.forEach(paragraph => {
        pdf.setFontSize(TYPOGRAPHY.bodySize);
        pdf.setFont(TYPOGRAPHY.bodyFont, 'italic');
        pdf.setTextColor(60, 60, 60);
        const quoteLines = wrapText(pdf, paragraph, PDF_CONFIG.contentWidth - 20);
        quoteLines.forEach(line => {
          if (y > PDF_CONFIG.height - 60) {
            addPageNumber(pdf, tracker.currentPage);
            pdf.addPage();
            tracker.currentPage++;
            y = PDF_CONFIG.margin;
            pdf.setFontSize(TYPOGRAPHY.bodySize);
            pdf.setFont(TYPOGRAPHY.bodyFont, 'italic');
            pdf.setTextColor(60, 60, 60);
          }
          pdf.text(line, PDF_CONFIG.margin + 10, y);
          y += TYPOGRAPHY.bodySize * TYPOGRAPHY.bodyLineHeight;
        });
        y += TYPOGRAPHY.bodySize * TYPOGRAPHY.bodyLineHeight;
      });

      if (page.quote_attribute) {
        if (y > PDF_CONFIG.height - 60) {
          addPageNumber(pdf, tracker.currentPage);
          pdf.addPage();
          tracker.currentPage++;
          y = PDF_CONFIG.margin;
        }
        pdf.setFontSize(TYPOGRAPHY.bodySize);
        pdf.setFont(TYPOGRAPHY.bodyFont, 'normal');
        pdf.setTextColor(60, 60, 60);
        pdf.text(`— ${page.quote_attribute}`, PDF_CONFIG.margin + 10, y);
        y += TYPOGRAPHY.bodySize * TYPOGRAPHY.bodyLineHeight + 5;
      }
      pdf.setTextColor(TYPOGRAPHY.bodyColor.r, TYPOGRAPHY.bodyColor.g, TYPOGRAPHY.bodyColor.b);
      y += 8;
    }

    if (page.content) {
      const contentText = parseMarkdownToText(page.content);
      const paragraphs = contentText.split('\n\n');

      paragraphs.forEach(paragraph => {
        pdf.setFontSize(TYPOGRAPHY.bodySize);
        pdf.setFont(TYPOGRAPHY.bodyFont, 'normal');
        pdf.setTextColor(TYPOGRAPHY.bodyColor.r, TYPOGRAPHY.bodyColor.g, TYPOGRAPHY.bodyColor.b);
        const contentLines = wrapText(pdf, paragraph, PDF_CONFIG.contentWidth);
        contentLines.forEach(line => {
          if (y > PDF_CONFIG.height - 60) {
            addPageNumber(pdf, tracker.currentPage);
            pdf.addPage();
            tracker.currentPage++;
            y = PDF_CONFIG.margin;
            pdf.setFontSize(TYPOGRAPHY.bodySize);
            pdf.setFont(TYPOGRAPHY.bodyFont, 'normal');
            pdf.setTextColor(TYPOGRAPHY.bodyColor.r, TYPOGRAPHY.bodyColor.g, TYPOGRAPHY.bodyColor.b);
          }
          pdf.text(line, PDF_CONFIG.margin, y);
          y += TYPOGRAPHY.bodySize * TYPOGRAPHY.bodyLineHeight;
        });
        y += TYPOGRAPHY.bodySize * TYPOGRAPHY.bodyLineHeight;
      });
    }

    addPageNumber(pdf, tracker.currentPage);
  }
}

async function addChapterGallery(
  pdf: jsPDF,
  chapter: ChapterWithFullData,
  tracker: PageTracker
): Promise<void> {
  if (!chapter.galleryItems || chapter.galleryItems.length === 0) return;

  const imagesPerPage = 6;
  const imageSpacing = 8;
  const imagesPerRow = 2;
  const captionSectionHeight = 80;
  const availableHeightForImages = PDF_CONFIG.height - PDF_CONFIG.margin * 2 - captionSectionHeight;
  const imageWidth = (PDF_CONFIG.contentWidth - imageSpacing) / imagesPerRow;

  for (let i = 0; i < chapter.galleryItems.length; i += imagesPerPage) {
    pdf.addPage();
    tracker.currentPage++;

    const pageImages = chapter.galleryItems.slice(i, i + imagesPerPage);
    const imageData: Array<{ item: any; dims: { width: number; height: number }; x: number; y: number }> = [];

    let currentX = PDF_CONFIG.margin;
    let currentY = PDF_CONFIG.margin;
    let maxHeightInRow = 0;
    let imagesInCurrentRow = 0;

    for (const item of pageImages) {
      try {
        const galleryImage = await loadImageAsBase64(item.image_url);
        const imgDimensions = await getImageDimensions(item.image_url);

        const maxImageHeight = availableHeightForImages / Math.ceil(imagesPerPage / imagesPerRow) - imageSpacing;
        const dims = calculateImageDimensions(
          imgDimensions.width,
          imgDimensions.height,
          imageWidth,
          maxImageHeight
        );

        imageData.push({
          item,
          dims,
          x: currentX + (imageWidth - dims.width) / 2,
          y: currentY
        });

        maxHeightInRow = Math.max(maxHeightInRow, dims.height);
        imagesInCurrentRow++;

        if (imagesInCurrentRow >= imagesPerRow) {
          currentX = PDF_CONFIG.margin;
          currentY += maxHeightInRow + imageSpacing;
          maxHeightInRow = 0;
          imagesInCurrentRow = 0;
        } else {
          currentX += imageWidth + imageSpacing;
        }
      } catch (error) {
        console.error('Error loading gallery image:', error);
      }
    }

    for (const imgData of imageData) {
      try {
        const galleryImage = await loadImageAsBase64(imgData.item.image_url);
        pdf.addImage(galleryImage, 'JPEG', imgData.x, imgData.y, imgData.dims.width, imgData.dims.height);
      } catch (error) {
        console.error('Error adding gallery image:', error);
      }
    }

    const captionsStartY = PDF_CONFIG.height - captionSectionHeight + 10;
    let captionY = captionsStartY;
    let captionNumber = i + 1;

    pdf.setFontSize(TYPOGRAPHY.captionSize);
    pdf.setFont(TYPOGRAPHY.bodyFont, 'normal');
    pdf.setTextColor(TYPOGRAPHY.captionColor.r, TYPOGRAPHY.captionColor.g, TYPOGRAPHY.captionColor.b);

    for (const imgData of imageData) {
      const item = imgData.item;
      if (item.image_caption || item.image_title) {
        const caption = item.image_title
          ? `${captionNumber}. ${item.image_title}${item.image_caption ? ': ' + item.image_caption : ''}`
          : `${captionNumber}. ${item.image_caption || ''}`;

        const captionLines = wrapText(pdf, caption, PDF_CONFIG.contentWidth);
        captionLines.forEach(line => {
          if (captionY > PDF_CONFIG.height - 25) {
            return;
          }
          pdf.text(line, PDF_CONFIG.margin, captionY);
          captionY += TYPOGRAPHY.captionSize * TYPOGRAPHY.captionLineHeight;
        });
        captionY += 2;
      }
      captionNumber++;
    }

    pdf.setTextColor(TYPOGRAPHY.bodyColor.r, TYPOGRAPHY.bodyColor.g, TYPOGRAPHY.bodyColor.b);
    addPageNumber(pdf, tracker.currentPage);
  }
}

async function addThankYouPage(pdf: jsPDF, tracker: PageTracker): Promise<void> {
  pdf.addPage();
  tracker.currentPage++;

  const centerY = PDF_CONFIG.height / 2 - 60;

  try {
    const logoImage = await loadImageAsBase64(SITE_ICON_URL);
    const logoWidth = 120;
    const logoHeight = 60;
    const x = (PDF_CONFIG.width - logoWidth) / 2;
    pdf.addImage(logoImage, 'PNG', x, centerY - 80, logoWidth, logoHeight);
  } catch (error) {
    console.error('Error adding logo to thank you page:', error);
  }

  pdf.setFontSize(18);
  pdf.setFont(TYPOGRAPHY.titleFont, 'bold');
  pdf.setTextColor(TYPOGRAPHY.titleColor.r, TYPOGRAPHY.titleColor.g, TYPOGRAPHY.titleColor.b);
  let y = centerY;

  const thankYouText = 'Thank you for reading my\nLasting Legacy Online Story';
  const lines = thankYouText.split('\n');
  lines.forEach(line => {
    pdf.text(line, PDF_CONFIG.width / 2, y, { align: 'center' });
    y += 18 * 1.3;
  });
}

export async function generateBookPDF(bookData: BookWithFullData, onProgress?: (progress: number) => void): Promise<void> {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: [PDF_CONFIG.width, PDF_CONFIG.height]
    });

    const tracker: PageTracker = {
      currentPage: 0,
      shouldShowPageNumber: false
    };

    const totalSteps = 5 + bookData.chapters.length * 3;
    let currentStep = 0;

    const updateProgress = () => {
      currentStep++;
      if (onProgress) {
        onProgress(Math.round((currentStep / totalSteps) * 100));
      }
    };

    await addCoverPage(pdf, bookData, tracker);
    updateProgress();

    await addBlankPage(pdf, tracker);
    updateProgress();

    await addTitlePage(pdf, bookData, tracker);
    updateProgress();

    await addBlankPage(pdf, tracker);
    updateProgress();

    await addDedicationPage(pdf, bookData, tracker);
    updateProgress();

    await addIntroPage(pdf, bookData, tracker);
    updateProgress();

    for (const chapter of bookData.chapters) {
      await addChapterTitlePage(pdf, chapter, tracker);
      updateProgress();

      await addChapterContent(pdf, chapter, tracker);
      updateProgress();

      await addChapterGallery(pdf, chapter, tracker);
      updateProgress();
    }

    await addThankYouPage(pdf, tracker);
    updateProgress();

    const fileName = `${bookData.book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}
