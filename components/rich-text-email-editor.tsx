"use client";

import FontFamily from "@tiptap/extension-font-family";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Redo2,
  UnderlineIcon,
  Undo2,
} from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

type RichTextEmailEditorProps = {
  value: string;
  onChange: (html: string) => void;
  compact?: boolean;
};

const toolbarButton =
  "grid size-8 place-items-center rounded-md text-zinc-600 transition hover:bg-zinc-100 hover:text-black disabled:opacity-35";

export function RichTextEmailEditor({ value, onChange, compact = false }: RichTextEmailEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      TextStyle,
      FontFamily.configure({ types: ["textStyle"] }),
      FontSize.configure({ types: ["textStyle"] }),
      Underline,
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          `email-editor-body ${compact ? "min-h-40" : "min-h-64"} px-4 py-4 text-sm leading-6 text-zinc-900 outline-none`,
      },
    },
    onUpdate: ({ editor: nextEditor }) => onChange(nextEditor.getHTML()),
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return <div className="min-h-72 animate-pulse rounded-lg border border-zinc-200 bg-zinc-50" />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:border-black focus-within:ring-1 focus-within:ring-black">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5">
        <select
          value={editor.getAttributes("textStyle").fontFamily || "Arial"}
          onChange={(event) => editor.chain().focus().setFontFamily(event.target.value).run()}
          className="mr-1 h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none"
          aria-label="Font family"
        >
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
        </select>
        <select
          value={editor.getAttributes("textStyle").fontSize || "14px"}
          onChange={(event) => editor.chain().focus().setFontSize(event.target.value).run()}
          className="mr-1 h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none"
          aria-label="Font size"
        >
          <option value="12px">12</option>
          <option value="14px">14</option>
          <option value="16px">16</option>
          <option value="18px">18</option>
          <option value="24px">24</option>
        </select>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(toolbarButton, editor.isActive("bold") && "bg-zinc-200 text-black")}
          aria-label="Bold"
          title="Bold"
        >
          <Bold className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(toolbarButton, editor.isActive("italic") && "bg-zinc-200 text-black")}
          aria-label="Italic"
          title="Italic"
        >
          <Italic className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn(toolbarButton, editor.isActive("underline") && "bg-zinc-200 text-black")}
          aria-label="Underline"
          title="Underline"
        >
          <UnderlineIcon className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-zinc-200" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(toolbarButton, editor.isActive("bulletList") && "bg-zinc-200 text-black")}
          aria-label="Bulleted list"
          title="Bulleted list"
        >
          <List className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(toolbarButton, editor.isActive("orderedList") && "bg-zinc-200 text-black")}
          aria-label="Numbered list"
          title="Numbered list"
        >
          <ListOrdered className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-zinc-200" />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className={toolbarButton}
          aria-label="Undo"
          title="Undo"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className={toolbarButton}
          aria-label="Redo"
          title="Redo"
        >
          <Redo2 className="size-4" />
        </button>
        <span className="ml-auto hidden text-[11px] text-zinc-400 sm:block">Paste signatures directly</span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
