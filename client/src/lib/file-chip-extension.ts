import { Node, mergeAttributes } from '@tiptap/core';

export interface FileChipAttributes {
  src: string;
  name: string;
  type: string;
}

/**
 * Inline atom node representing an attached file (e.g. an image) stored as a
 * data URL. Rendered as a clickable chip at the position the user inserted it;
 * read views open the underlying file in a new tab.
 */
export const FileChip = Node.create({
  name: 'fileChip',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      name: { default: 'attachment' },
      type: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-file-chip]',
        getAttrs: (el) => ({
          src: el.getAttribute('href') ?? '',
          name: el.getAttribute('data-file-name') ?? 'attachment',
          type: el.getAttribute('data-file-type') ?? '',
        }),
      },
    ];
  },

  renderHTML({ node }) {
    const attrs = node.attrs as FileChipAttributes;
    return [
      'a',
      mergeAttributes({
        'data-file-chip': '',
        'data-file-name': attrs.name,
        'data-file-type': attrs.type,
        href: attrs.src,
        class: 'file-chip',
      }),
      attrs.name,
    ];
  },
});
