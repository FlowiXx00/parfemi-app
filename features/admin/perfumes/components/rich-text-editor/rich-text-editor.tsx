"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { sanitizeRichText } from "@/shared/lib/rich-text";
import styles from "./rich-text-editor.module.css";

type RichTextEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Unesi opis parfema...",
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [3],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: sanitizeRichText(value || "<p></p>"),
    editorProps: {
      attributes: {
        class: styles.editorContent ?? "",
      },
    },
    onUpdate: ({ editor }) => {
      const html = sanitizeRichText(editor.getHTML());
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor) return;

    const incoming = sanitizeRichText(value || "<p></p>");
    const current = sanitizeRichText(editor.getHTML());

    if (incoming !== current) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  const preventBlur = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${styles.toolButton} ${
            editor.isActive("bold") ? styles.active : ""
          }`}
          onMouseDown={preventBlur}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
          aria-label="Bold"
        >
          <strong>B</strong>
        </button>

        <button
          type="button"
          className={`${styles.toolButton} ${
            editor.isActive("italic") ? styles.active : ""
          }`}
          onMouseDown={preventBlur}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
          aria-label="Italic"
        >
          <em>I</em>
        </button>

        <button
          type="button"
          className={`${styles.toolButton} ${
            editor.isActive("underline") ? styles.active : ""
          }`}
          onMouseDown={preventBlur}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
          aria-label="Underline"
        >
          <u>U</u>
        </button>

        <span className={styles.divider} />

        <button
          type="button"
          className={`${styles.toolButton} ${
            editor.isActive("heading", { level: 3 }) ? styles.active : ""
          }`}
          onMouseDown={preventBlur}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Naslov"
          aria-label="Naslov"
        >
          H3
        </button>

        <button
          type="button"
          className={`${styles.toolButton} ${
            editor.isActive("paragraph") ? styles.active : ""
          }`}
          onMouseDown={preventBlur}
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="Pasus"
          aria-label="Pasus"
        >
          P
        </button>

        <span className={styles.divider} />

        <button
          type="button"
          className={`${styles.toolButton} ${
            editor.isActive("bulletList") ? styles.active : ""
          }`}
          onMouseDown={preventBlur}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Lista"
          aria-label="Lista"
        >
          • List
        </button>

        <button
          type="button"
          className={`${styles.toolButton} ${
            editor.isActive("orderedList") ? styles.active : ""
          }`}
          onMouseDown={preventBlur}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numerisana lista"
          aria-label="Numerisana lista"
        >
          1. List
        </button>

        <button
          type="button"
          className={`${styles.toolButton} ${
            editor.isActive("blockquote") ? styles.active : ""
          }`}
          onMouseDown={preventBlur}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Istaknut tekst"
          aria-label="Istaknut tekst"
        >
          ❝
        </button>

        <span className={styles.spacer} />

        <button
          type="button"
          className={styles.toolButton}
          onMouseDown={preventBlur}
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Skini format"
          aria-label="Skini format"
        >
          Clear
        </button>
      </div>

      <div className={styles.editor}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}