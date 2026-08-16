import { describe, it, expect, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { SignedImage } from "./signed-image";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({ createSignedUrl: vi.fn(async () => ({ data: null, error: null })) }),
    },
  },
}));

function makeEditor(content: string) {
  return new Editor({
    extensions: [StarterKit.configure({ codeBlock: false }), SignedImage],
    content,
  });
}

describe("SignedImage node", () => {
  it("parses a stored library-images path into a node and serializes the path back", () => {
    const editor = makeEditor(
      '<p>before</p><img src="user-1/library-images/123-photo.png" alt="pic" /><p>after</p>',
    );

    const html = editor.getHTML();
    // The storage path survives (never replaced with a signed URL on save).
    expect(html).toContain('src="user-1/library-images/123-photo.png"');
    expect(html).toContain('alt="pic"');
    expect(editor.state.doc.type.name).toBe("doc");
    editor.destroy();
  });

  it("inserts a signedImage node and stores the path, not a signed URL", () => {
    const editor = makeEditor("<p></p>");

    editor.commands.insertContent({
      type: "signedImage",
      attrs: { src: "user-1/library-images/x.png" },
    });

    expect(editor.getHTML()).toContain('src="user-1/library-images/x.png"');
    editor.destroy();
  });
});
