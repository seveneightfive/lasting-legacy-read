import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import FigureNodeView from './FigureNodeView';

/**
 * Figure node — handles 1 or 2 images with a shared, inline-editable caption.
 *
 * SCHEMA
 * ------
 * - Block-level node
 * - content: 'inline*'  → the caption is real ProseMirror content (editable!)
 * - Images live in the `images` attribute as an array of { src, alt }
 *
 * Layouts supported:
 *   - 'single'     → one image stacked above the caption
 *   - 'side-by-side' → two images in a row, shared caption below
 *
 * Why content + NodeView instead of atom + attribute caption:
 *   atom nodes can't have editable children. Users need to click the caption
 *   and edit it like any other text, so the caption MUST be ProseMirror
 *   content. The NodeView renders the images via React; <NodeViewContent />
 *   marks where ProseMirror puts the caption text.
 *
 * Why a custom NodeView at all (rather than just renderHTML):
 *   We need hover overlays, replace/remove/toggle-layout buttons, drag-drop
 *   for replacement, and access to the Supabase upload hook. None of that
 *   works in a plain serialized DOM rendering.
 *
 * Serialized HTML shape (what gets saved + what the reader sees):
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
 *
 * The reader's existing .markdown-body figure CSS handles single naturally;
 * .figure-grid-2 is added to index.css for the 2-up layout.
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
  content: 'inline*',           // caption text lives here
  defining: true,                // selection treats it as a unit
  isolating: true,               // can't merge with surrounding blocks

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
          const imgs = Array.from(el.querySelectorAll('img'));
          return imgs.map((img) => ({
            src: img.getAttribute('src') ?? '',
            alt: img.getAttribute('alt') ?? null,
          }));
        },
        renderHTML: () => ({}),  // images are rendered as separate children below
      },
    };
  },

  parseHTML() {
    return [
      {
        // Higher priority than the standalone Image extension so <figure>s
        // are claimed by us, not by Image picking off the inner <img>.
        tag: 'figure',
        priority: 60,
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          if (!node.querySelector('img')) return false;
          return {};  // attributes are derived by addAttributes parseHTML
        },
        // Tell ProseMirror to read caption text from the <figcaption>
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
      ['figcaption', {}, 0],  // 0 = ProseMirror's "render content here" sentinel
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureNodeView);
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
            // Add a paragraph after so the caret lands somewhere natural
            .insertContent({ type: 'paragraph' })
            .run();
        },
    };
  },
});
