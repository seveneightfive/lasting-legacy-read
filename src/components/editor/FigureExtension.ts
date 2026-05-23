import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import FigureNodeView from './FigureNodeView';

/**
 * Figure node — handles 1 or 2 images with a shared, inline-editable caption.
 *
 * IMPORTANT ARCHITECTURE NOTE
 * ---------------------------
 * The schema's `content` is `inline*` — meaning the only ProseMirror content
 * is the caption text. Images are stored in the `images` attribute (array of
 * { src, alt }), NOT as ProseMirror child nodes.
 *
 * This means:
 *   - In the editor, the React NodeView paints the images from attributes.
 *   - In serialized HTML (what gets saved to the DB and read by the reader),
 *     renderHTML re-creates <img> tags from the attribute so the reader's
 *     dangerouslySetInnerHTML produces correct DOM.
 *   - parseHTML reads images back into the attribute when loading from saved
 *     HTML.
 *
 * Why not make images ProseMirror child nodes?
 *   ProseMirror would then need a place to render them in the live editor
 *   DOM via NodeViewContent. But NodeViewContent captures ALL content,
 *   including the caption — and ProseMirror would mix imgs and text in the
 *   same anchor, causing the imgs to end up inside the figcaption. Keeping
 *   imgs as attributes lets the NodeView render them independently in
 *   exactly the right spot in the visual layout.
 *
 * Layouts:
 *   - 'single'       → one image stacked above caption
 *   - 'side-by-side' → two images in a row, shared caption below
 *
 * Serialized HTML shape (what gets saved + what reader renders):
 *   Single:
 *     <figure data-layout="single">
 *       <img src="..." alt="..." />
 *       <figcaption>...</figcaption>
 *     </figure>
 *   Side-by-side:
 *     <figure data-layout="side-by-side" class="figure-grid-2">
 *       <img src="..." alt="..." />
 *       <img src="..." alt="..." />
 *       <figcaption>...</figcaption>
 *     </figure>
 */
export interface FigureOptions {
  /** Book slug used as the storage folder for image uploads (for "Replace") */
  bookSlug: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figure: {
      /** Insert a figure with the given images and (optional) caption */
      insertFigure: (attrs: {
        layout: 'single' | 'side-by-side';
        images: Array<{ src: string; alt?: string | null }>;
        caption?: string;
      }) => ReturnType;
    };
  }
}

export const Figure = Node.create<FigureOptions>({
  name: 'figure',

  addOptions() {
    return { bookSlug: '' };
  },

  group: 'block',
  content: 'inline*',           // ONLY the caption text lives in PM content
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      layout: {
        default: 'single',
        parseHTML: (el) => el.getAttribute('data-layout') ?? 'single',
        renderHTML: (attrs) => ({ 'data-layout': attrs.layout }),
      },
      images: {
        default: [] as Array<{ src: string; alt?: string | null }>,
        parseHTML: (el) => {
          const imgs = Array.from(el.querySelectorAll(':scope > img'));
          return imgs.map((img) => ({
            src: img.getAttribute('src') ?? '',
            alt: img.getAttribute('alt') ?? null,
          }));
        },
        // Don't write images as attribute on the figure element itself —
        // they're rendered as <img> children in renderHTML below.
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        priority: 60,
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          if (!node.querySelector('img')) return false;
          return {};
        },
        // Caption text lives in <figcaption>; ignore <img> children so PM
        // doesn't try to absorb them into the inline* content.
        contentElement: (node) => {
          if (!(node instanceof HTMLElement)) return node;
          return node.querySelector('figcaption') ?? node;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const layout = (HTMLAttributes as Record<string, string>)['data-layout'] ?? 'single';
    const images: Array<{ src: string; alt?: string | null }> =
      (node.attrs.images as Array<{ src: string; alt?: string | null }>) ?? [];

    const figureAttrs = mergeAttributes(HTMLAttributes, {
      class: layout === 'side-by-side' ? 'figure-grid-2' : undefined,
    });

    const imgChildren = images.map((img) => {
      const attrs: Record<string, string> = { src: img.src ?? '' };
      if (img.alt) attrs.alt = img.alt;
      return ['img', attrs] as [string, Record<string, string>];
    });

    return [
      'figure',
      figureAttrs,
      ...imgChildren,
      ['figcaption', {}, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureNodeView, {
      // Tell ProseMirror that the contentDOM (where inline* content goes)
      // is the figcaption. Without this, ProseMirror tries to render the
      // images into the NodeViewContent slot too, ending up inside the
      // caption.
      contentDOMElementTag: 'figcaption',
    });
  },

  addCommands() {
    return {
      insertFigure:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: {
                layout: attrs.layout,
                images: attrs.images,
              },
              content: attrs.caption
                ? [{ type: 'text', text: attrs.caption }]
                : [],
            })
            .insertContent({ type: 'paragraph' })
            .run();
        },
    };
  },
});
