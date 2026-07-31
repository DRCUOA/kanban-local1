/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link2,
  Paperclip,
  Undo2,
  Redo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { FileChip } from '@/lib/file-chip-extension';
import {
  toRichHtml,
  sanitizeRichText,
  fileToDataUrl,
  FILE_CHIP_ACCEPTED_TYPES,
  FILE_CHIP_MAX_BYTES,
} from '@/lib/rich-text';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  'data-testid'?: string;
}

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon: Icon, label, active, disabled, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      // onMouseDown preventDefault keeps focus (and the selection) in the editor.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'h-9 w-9 shrink-0 rounded-lg flex items-center justify-center transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'opacity-40 pointer-events-none',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Add details...',
  className,
  'data-testid': testId,
}: RichTextEditorProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const lastValueRef = useRef<string>(value || '');
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder }),
      FileChip,
    ],
    content: toRichHtml(value),
    editorProps: {
      attributes: {
        class: 'rich-text focus:outline-none min-h-[96px] px-4 py-3',
      },
      handleDOMEvents: {
        // Mobile virtual keyboards (notably Chrome/GBoard on Android) don't
        // deliver a usable Enter keydown — ProseMirror suppresses keyCode 13
        // there and falls back to DOM-diffing, which is unreliable. The
        // beforeinput event still fires with a precise inputType, so handle
        // the split ourselves. Desktop is unaffected: a handled keydown
        // prevents the beforeinput from ever firing.
        beforeinput: (_view, event) => {
          const inputType = event.inputType;
          if (inputType !== 'insertParagraph' && inputType !== 'insertLineBreak') return false;
          const ed = editorRef.current;
          if (!ed) return false;
          event.preventDefault();
          if (inputType === 'insertLineBreak') {
            ed.commands.setHardBreak();
          } else {
            // Runs the full Enter keymap (splits list items, exits quotes, …).
            ed.commands.keyboardShortcut('Enter');
          }
          return true;
        },
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.isEmpty ? '' : sanitizeRichText(e.getHTML());
      lastValueRef.current = html;
      onChange(html);
    },
  });
  editorRef.current = editor;

  // Sync external resets (e.g. form.reset) without clobbering in-progress typing.
  useEffect(() => {
    if (!editor) return;
    if ((value || '') === lastValueRef.current) return;
    lastValueRef.current = value || '';
    editor.commands.setContent(toRichHtml(value));
  }, [value, editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            underline: e.isActive('underline'),
            strike: e.isActive('strike'),
            bulletList: e.isActive('bulletList'),
            orderedList: e.isActive('orderedList'),
            blockquote: e.isActive('blockquote'),
            code: e.isActive('code'),
            link: e.isActive('link'),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });

  if (!editor) return null;

  const openLinkPopover = (open: boolean) => {
    if (open) {
      setLinkUrl((editor.getAttributes('link').href as string) || '');
    }
    setLinkOpen(open);
  };

  const applyLink = () => {
    let href = linkUrl.trim();
    if (href && !/^(https?:|mailto:|tel:)/i.test(href)) {
      href = `https://${href}`;
    }
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!href) {
      chain.unsetLink().run();
    } else if (editor.state.selection.empty && !editor.isActive('link')) {
      // Nothing selected: insert the URL itself as the link text.
      editor
        .chain()
        .focus()
        .insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] })
        .insertContent(' ')
        .run();
    } else {
      chain.setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  const insertFile = async (file: File) => {
    if (!FILE_CHIP_ACCEPTED_TYPES.some((prefix) => file.type.startsWith(prefix))) {
      toast({
        title: 'Unsupported file',
        description: 'Only image files can be attached.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > FILE_CHIP_MAX_BYTES) {
      toast({
        title: 'File too large',
        description: `Attachments are limited to ${Math.round(FILE_CHIP_MAX_BYTES / 1024 / 1024)}MB.`,
        variant: 'destructive',
      });
      return;
    }
    const src = await fileToDataUrl(file);
    editor
      .chain()
      .focus()
      .insertContent({ type: 'fileChip', attrs: { src, name: file.name, type: file.type } })
      .insertContent(' ')
      .run();
  };

  return (
    <div
      className={cn('rich-editor neo-input rounded-xl bg-card text-base', className)}
      data-testid={testId}
    >
      <div className="flex flex-wrap items-center gap-0.5 px-2 pt-2">
        <ToolbarButton
          icon={Bold}
          label="Bold"
          active={state?.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          label="Italic"
          active={state?.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={Underline}
          label="Underline"
          active={state?.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          icon={Strikethrough}
          label="Strikethrough"
          active={state?.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton
          icon={List}
          label="Bullet list"
          active={state?.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Numbered list"
          active={state?.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          icon={Quote}
          label="Quote"
          active={state?.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          icon={Code}
          label="Code"
          active={state?.code}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
        <div className="w-px h-5 bg-border mx-1" />
        <Popover open={linkOpen} onOpenChange={openLinkPopover}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Link"
              aria-pressed={state?.link}
              title="Link"
              onMouseDown={(e) => e.preventDefault()}
              className={cn(
                'h-9 w-9 shrink-0 rounded-lg flex items-center justify-center transition-colors',
                state?.link
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Link2 className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="flex gap-2">
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="h-9 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyLink();
                  }
                }}
                data-testid="input-link-url"
              />
              <Button type="button" size="sm" className="h-9" onClick={applyLink}>
                {linkUrl.trim() ? 'Set' : 'Remove'}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <ToolbarButton
          icon={Paperclip}
          label="Attach image"
          onClick={() => fileInputRef.current?.click()}
        />
        <div className="flex-1" />
        <ToolbarButton
          icon={Undo2}
          label="Undo"
          disabled={!state?.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          icon={Redo2}
          label="Redo"
          disabled={!state?.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="input-attach-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) insertFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
