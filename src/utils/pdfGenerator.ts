import jsPDF from 'jspdf';
import { Book } from '../lib/supabase';
import { ChapterWithPages } from '../lib/pdfUtils';

export async function downloadBookPDF(book: Book, chaptersWithPages: ChapterWithPages[]) {
  try {
    const pdf = new jsPDF();
    let yPosition = 20;
    const pageHeight = pdf.internal.pageSize.height;
    const pageWidth = pdf.internal.pageSize.width;
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);

    // Helper function to add new page if needed
    const checkPageBreak = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
    };

    // Helper function to wrap text
    const addWrappedText = (text: string, fontSize: number, isBold = false) => {
      pdf.setFontSize(fontSize);
      if (isBold) {
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setFont('helvetica', 'normal');
      }
      
      const lines = pdf.splitTextToSize(text, maxWidth);
      const lineHeight = fontSize * 0.4;
      
      checkPageBreak(lines.length * lineHeight);
      
      lines.forEach((line: string) => {
        pdf.text(line, margin, yPosition);
        yPosition += lineHeight;
      });
      
      yPosition += 5; // Add some spacing after text
    };

    // Title page
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text(book.title, pageWidth / 2, 60, { align: 'center' });
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`by ${book.author}`, pageWidth / 2, 80, { align: 'center' });

    // Add dedication if exists
    if (book.dedication) {
      pdf.addPage();
      yPosition = 60;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Dedication', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
      addWrappedText(book.dedication, 12);
    }

    // Add intro if exists
    if (book.intro) {
      pdf.addPage();
      yPosition = margin;
      addWrappedText('Introduction', 16, true);
      yPosition += 10;
      addWrappedText(book.intro, 12);
    }

    // Add chapters
    chaptersWithPages.forEach((chapter) => {
      // Chapter title page
      pdf.addPage();
      yPosition = 60;
      
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Chapter ${chapter.chapter_number}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
      
      pdf.setFontSize(18);
      pdf.text(chapter.title, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 30;

      // Chapter heading if exists
      if (chapter.heading) {
        addWrappedText(chapter.heading, 14, true);
      }

      // Chapter lede if exists
      if (chapter.lede) {
        addWrappedText(chapter.lede, 12);
      }

      // Chapter pages
      if (chapter.pages) {
        chapter.pages.forEach((page) => {
          switch (page.type) {
            case 'subheading':
              if (page.content) {
                yPosition += 10;
                addWrappedText(page.content, 14, true);
              }
              break;
            case 'content':
              if (page.content) {
                addWrappedText(page.content, 12);
              }
              break;
            case 'quote':
              if (page.content) {
                yPosition += 10;
                pdf.setFont('helvetica', 'italic');
                addWrappedText(`"${page.content}"`, 12);
                yPosition += 5;
              }
              break;
            case 'image':
              if (page.image_caption) {
                yPosition += 10;
                addWrappedText(`[Image: ${page.image_caption}]`, 10);
              }
              break;
          }
        });
      }
    });

    // Download the PDF
    pdf.save(`${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}