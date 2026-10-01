"use client";

import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extensions";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadEmailImage } from "@/app/(app)/admin/emails/actions";
import { EMAIL_IMAGE_MAX_BYTES, EMAIL_IMAGE_MAX_WIDTH } from "@/lib/email/limits";

/** A short palette — enough for emphasis, few enough to stay readable. */
const COLORS = ["#1c1917", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#9333ea"];

/**
 * Scales a photo down before upload: a phone picture is several MB and far
 * wider than any email. GIFs are left alone — redrawing would stop them moving.
 */
async function shrinkImage(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, EMAIL_IMAGE_MAX_WIDTH / bitmap.width);
  if (scale === 1 && file.size <= EMAIL_IMAGE_MAX_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // PNG keeps transparency (screenshots, logos); everything else is a photo.
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  return blob ?? file;
}

/**
 * A Gmail-style editor for an email body: formatting, lists, links, colour
 * and pictures. Pictures are uploaded as soon as they are added — picked,
 * pasted or dropped — and placed by their link.
 *
 * `onChange` gets HTML; the server sanitises it again before storing.
 */
export function EmailEditor({
  initialHtml = "",
  onChange,
  placeholder,
  minHeight = 160,
}: {
  initialHtml?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  // The paste and drop handlers are created once, before the editor exists;
  // they read it from here rather than from the first render's null.
  const editorRef = useRef<Editor | null>(null);

  async function insertImages(editor: Editor, files: File[], position?: number) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    for (const file of images) {
      setUploading((count) => count + 1);
      try {
        const blob = await shrinkImage(file);
        const formData = new FormData();
        formData.append("file", blob, file.name);
        const result = await uploadEmailImage(formData);
        if (!result.ok) {
          toast.error(result.error);
          continue;
        }
        const node = { type: "image", attrs: { src: result.data!.src, alt: "" } };
        const chain = editor.chain().focus();
        (position === undefined ? chain.insertContent(node) : chain.insertContentAt(position, node))
          // A new picture is left selected, so the next key typed would
          // replace it. Carry on writing below it instead, as Gmail does.
          .command(({ tr }) => {
            tr.setSelection(TextSelection.near(tr.doc.resolve(tr.selection.to)));
            return true;
          })
          .run();
      } catch {
        toast.error("Không đọc được ảnh này.");
      } finally {
        setUploading((count) => count - 1);
      }
    }
    return images.length > 0;
  }

  const editor = useEditor({
    // Rendered on the server too; the editor must wait for the browser.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      // Base64 pictures are refused: Gmail will not show them. A pasted or
      // dropped picture is uploaded instead (editorProps below).
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: initialHtml,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
    editorProps: {
      attributes: { class: "email-content focus:outline-none px-3 py-2" },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        const current = editorRef.current;
        if (!files.some((file) => file.type.startsWith("image/")) || !current) return false;
        void insertImages(current, files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])];
        const current = editorRef.current;
        if (!files.some((file) => file.type.startsWith("image/")) || !current) return false;
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImages(current, files, position);
        return true;
      },
    },
  });
  editorRef.current = editor;

  return (
    <div className="bg-background focus-within:ring-ring/50 rounded-lg border focus-within:ring-3">
      {editor && (
        <Toolbar
          editor={editor}
          uploading={uploading > 0}
          onPickImage={() => fileInput.current?.click()}
        />
      )}
      <div style={{ minHeight }} className="cursor-text" onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (editor) void insertImages(editor, files);
        }}
      />
    </div>
  );
}

function Toolbar({
  editor,
  uploading,
  onPickImage,
}: {
  editor: Editor;
  uploading: boolean;
  onPickImage: () => void;
}) {
  const [panel, setPanel] = useState<"link" | "color" | null>(null);
  const [linkUrl, setLinkUrl] = useState("");

  // Re-render the toolbar when the selection's formatting changes.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      heading: editor.isActive("heading", { level: 2 }),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
      link: editor.isActive("link"),
      center: editor.isActive({ textAlign: "center" }),
      right: editor.isActive({ textAlign: "right" }),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  function openLink() {
    setLinkUrl(editor.getAttributes("link").href ?? "");
    setPanel(panel === "link" ? null : "link");
  }

  function applyLink() {
    const url = linkUrl.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!url) chain.unsetLink().run();
    else {
      const href = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
      // With nothing selected, the link's own address becomes its text.
      if (editor.state.selection.empty && !state.link) {
        chain.insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href } }] }).run();
      } else {
        chain.setLink({ href }).run();
      }
    }
    setPanel(null);
  }

  const tools: Array<
    | { icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; run: () => void }
    | "divider"
  > = [
    { icon: Undo2, label: "Hoàn tác", disabled: !state.canUndo, run: () => editor.chain().focus().undo().run() },
    { icon: Redo2, label: "Làm lại", disabled: !state.canRedo, run: () => editor.chain().focus().redo().run() },
    "divider",
    { icon: Bold, label: "In đậm", active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { icon: Italic, label: "In nghiêng", active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { icon: Underline, label: "Gạch chân", active: state.underline, run: () => editor.chain().focus().toggleUnderline().run() },
    { icon: Strikethrough, label: "Gạch ngang", active: state.strike, run: () => editor.chain().focus().toggleStrike().run() },
    { icon: Palette, label: "Màu chữ", active: panel === "color", run: () => setPanel(panel === "color" ? null : "color") },
    "divider",
    { icon: Heading2, label: "Tiêu đề", active: state.heading, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { icon: List, label: "Danh sách", active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { icon: ListOrdered, label: "Danh sách số", active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { icon: Quote, label: "Trích dẫn", active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    "divider",
    { icon: AlignLeft, label: "Căn trái", active: !state.center && !state.right, run: () => editor.chain().focus().setTextAlign("left").run() },
    { icon: AlignCenter, label: "Căn giữa", active: state.center, run: () => editor.chain().focus().setTextAlign("center").run() },
    { icon: AlignRight, label: "Căn phải", active: state.right, run: () => editor.chain().focus().setTextAlign("right").run() },
    "divider",
    { icon: Link2, label: "Chèn liên kết", active: state.link || panel === "link", run: openLink },
    { icon: uploading ? Loader2 : ImagePlus, label: uploading ? "Đang tải ảnh…" : "Chèn ảnh", disabled: uploading, run: onPickImage },
  ];

  return (
    <div className="border-b">
      <div className="flex flex-wrap items-center gap-0.5 p-1">
        {tools.map((tool, index) =>
          tool === "divider" ? (
            <span key={index} aria-hidden className="bg-border mx-1 h-5 w-px" />
          ) : (
            <button
              key={tool.label}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={tool.active}
              disabled={tool.disabled}
              // Keep the editor's selection: a click on the toolbar would
              // otherwise blur it before the command runs.
              onMouseDown={(event) => event.preventDefault()}
              onClick={tool.run}
              className="hover:bg-accent aria-pressed:bg-accent aria-pressed:text-foreground text-muted-foreground flex size-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40"
            >
              <tool.icon className={`size-4 ${tool.icon === Loader2 ? "animate-spin" : ""}`} />
            </button>
          ),
        )}
      </div>

      {panel === "color" && (
        <div className="flex flex-wrap items-center gap-2 border-t px-2 py-2">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Màu ${color}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                editor.chain().focus().setColor(color).run();
                setPanel(null);
              }}
              className="size-6 rounded-full border shadow-sm"
              style={{ background: color }}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editor.chain().focus().unsetColor().run();
              setPanel(null);
            }}
          >
            Bỏ màu
          </Button>
        </div>
      )}

      {panel === "link" && (
        <div className="flex flex-wrap items-center gap-2 border-t px-2 py-2">
          <Input
            autoFocus
            value={linkUrl}
            placeholder="https://…"
            className="h-8 min-w-0 flex-1 basis-52"
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
              if (event.key === "Escape") setPanel(null);
            }}
          />
          <Button type="button" size="sm" onClick={applyLink}>
            {linkUrl.trim() ? "Áp dụng" : "Gỡ liên kết"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPanel(null)}>
            Thôi
          </Button>
        </div>
      )}
    </div>
  );
}
