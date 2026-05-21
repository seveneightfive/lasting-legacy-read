import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Custom Figure node that wraps an image with an optional visible caption.
 *
 * Renders as:
 *   <figure>
 *     <img src="..." alt="..." />
 *     <figcaption>...</figcaption>
 *   </figure>
 *
 * The figure is an atom (selected as a unit; delete removes both image + caption).
 * Matched by your existing `.markdown-body figure` styles so the reader displays
 * it identically.
 *
 * Why not @tiptap/extension-image alone:
 *   The official Image extension produces a bare <img>, with no caption. We
 *   want the caption visible (per UX feedback), so we register this node and
 *   emit <figure>/<figcaption> directly.
 *
 * Why this is an atom instead of having editable caption content:
 *   Editable captions inside contenteditable need a NodeView and careful
 *   selection management — out of scope here. The user enters the caption
 *   in the Insert Image dialog; if they want to change it, they can delete
 *   the figure and reinsert.
 */
export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      src:     { default: null },
      alt:     { default: null },
      caption: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          const img = node.querySelector('img');
          if (!img) return false;
          const cap = node.querySelector('figcaption');
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            caption: cap?.textContent ?? null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, caption } = HTMLAttributes as {
      src?: string | null;
      alt?: string | null;
      caption?: string | null;
    };

    const imgAttrs: Record<string, string> = { src: src ?? '' };
    if (alt) imgAttrs.alt = alt;

    if (caption && caption.trim()) {
      return [
        'figure',
        mergeAttributes({}, {}),
        ['img', imgAttrs],
        ['figcaption', {}, caption],
      ];
    }
    return [
      'figure',
      mergeAttributes({}, {}),
      ['img', imgAttrs],
    ];
  },
});
