import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import FigureNodeView from './FigureNodeView';

/**
 * Figure node — wraps 1+ images and a caption.
 *
 * SCHEMA
 * ------
 *   figure {
 *     attrs: { layout: 'single' | 'side-by-side' }
 *     content: figure_image+ figure_caption?
 *   }
 *   figure_image (atom, leaf) {
 *     attrs: { src: string, alt: string|null }
 *   }
 *   figure_caption {
 *     content: inline*       ← editable text
 *   }
 *
 * Why this architecture (different from v4):
 *   ProseMirror cannot serialize JavaScript arrays as node attributes. Earlier
 *   versions tried to store `images: [{src,alt}, ...]` as a single attribute,
 *   which silently broke ProseMirror's schema validation — the insertContent
 *   command succeeded API-wise but the node was never added to the document.
 *
 *   The fix: each image is its OWN child node, with string attributes (which
 *   ProseMirror handles fine). Layout is a simple string on the figure itself.
 *
 *   The serialized HTML still looks like a normal <figure> with <img>s and a
 *   <figcaption> — so the reader continues to render it via the existing CSS.
 */

export interface FigureOptions {
  bookSlug: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figure: {
      insertFigure: (params: {
        layout: 'single' | 'side-by-side';
        images: Array<{ src: string; alt?: string | null }>;
        caption?: string;
      }) => ReturnType;
    };
  }
}

// ─── figure_image (atom, no children) ────────────────────────────
export const FigureImage = Node.create({
  name: 'figureImage',
  group: 'figureContent',
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: null },
    };
  },

  parseHTML() {
    return [
      // Match <img> tags that live inside a <figure>
      {
        tag: 'figure img',
        priority: 70,
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          return {
            src: node.getAttribute('src') ?? '',
            alt: node.getAttribute('alt') ?? null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },
});

// ─── figure_caption (inline content) ─────────────────────────────
export const FigureCaption = Node.create({
  name: 'figureCaption',
  group: 'figureContent',
  content: 'inline*',
  defining: true,
  isolating: false,

  parseHTML() {
    return [{ tag: 'figcaption', priority: 70 }];
  },

  renderHTML() {
    return ['figcaption', { class: 'figure-caption' }, 0];
  },
});

// ─── figure (the wrapper) ────────────────────────────────────────
export const Figure = Node.create<FigureOptions>({
  name: 'figure',

  addOptions() {
    return { bookSlug: '' };
  },

  group: 'block',
  // 1+ images followed by an optional caption.
  // Both children are in the `figureContent` group defined above.
  content: 'figureImage+ figureCaption?',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      layout: {
        default: 'single',
        parseHTML: (el) => el.getAttribute('data-layout') ?? 'single',
        renderHTML: (attrs) => ({ 'data-layout': attrs.layout }),
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
          // Don't claim figures that are video embeds (we sanitize those separately)
          if (node.classList.contains('video-embed')) return false;
          if (!node.querySelector('img')) return false;
          return null; // null = match (attrs come from addAttributes parseHTML)
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const layout = (node.attrs.layout ?? 'single') as string;
    const cls = layout === 'side-by-side' ? 'figure-grid-2' : undefined;
    return [
      'figure',
      mergeAttributes(HTMLAttributes, cls ? { class: cls } : {}),
      0, // ProseMirror sentinel: render children here
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureNodeView);
  },

  addCommands() {
    return {
      insertFigure:
        (params) =>
        ({ chain }) => {
          // Build child node specs as plain JSON. Each image becomes a
          // figureImage atom; the caption (if any) becomes a figureCaption.
          const imageNodes = params.images.map((img) => ({
            type: 'figureImage',
            attrs: { src: img.src, alt: img.alt ?? null },
          }));

          const captionNodes = params.caption?.trim()
            ? [{
                type: 'figureCaption',
                content: [{ type: 'text', text: params.caption.trim() }],
              }]
            : [{
                // Always include an empty caption so users can click to add one
                type: 'figureCaption',
                content: [],
              }];

          return chain()
            .insertContent({
              type: this.name,
              attrs: { layout: params.layout },
              content: [...imageNodes, ...captionNodes],
            })
            .insertContent({ type: 'paragraph' })
            .run();
        },
    };
  },
});
