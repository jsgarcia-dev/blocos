import Image, { type ImageOptions } from "@tiptap/extension-image";

export interface BlocosImageOptions extends ImageOptions {
  /** Converte o `src` gravado no Markdown numa URL que a janela consegue exibir. */
  resolveSrc: (src: string) => string;
}

/** Imagem que guarda o caminho original (relativo ao documento) e exibe a versão resolvida. */
export const BlocosImage = Image.extend<BlocosImageOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: {},
      resize: false,
      inline: false,
      allowBase64: true,
      resolveSrc: (src: string) => src,
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const dom = document.createElement("figure");
      dom.className = "image-block";
      const img = document.createElement("img");
      const apply = (attrs: Record<string, any>) => {
        img.src = this.options.resolveSrc(attrs.src || "");
        img.alt = attrs.alt || "";
        if (attrs.title) img.title = attrs.title;
        else img.removeAttribute("title");
      };
      apply({ ...node.attrs, ...HTMLAttributes, src: node.attrs.src });
      img.draggable = false;
      dom.appendChild(img);
      return {
        dom,
        update: (updated) => {
          if (updated.type.name !== this.name) return false;
          apply(updated.attrs);
          return true;
        },
      };
    };
  },
});
