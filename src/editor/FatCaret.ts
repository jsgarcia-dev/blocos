import { Extension } from "@tiptap/core";
import { NodeSelection, Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * Cursor do mock: barra laranja de 2 px que pisca, 1 px depois do caractere.
 * O cursor nativo fica transparente (veja `caret-color` no CSS) e esta barra é
 * desenhada por cima, sem ocupar espaço no texto.
 */
export const FatCaret = Extension.create({
  name: "fatCaret",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        view(view: EditorView) {
          const el = document.createElement("div");
          el.className = "fat-caret";
          el.style.display = "none";
          let frame = 0;

          const draw = () => {
            frame = 0;
            const { selection } = view.state;
            const host = view.dom.closest(".sheet") as HTMLElement | null;
            const show =
              !!host &&
              view.editable &&
              view.hasFocus() &&
              selection.empty &&
              !(selection instanceof NodeSelection) &&
              !view.composing &&
              selection.$head.parent.inlineContent;
            if (!show || !host) {
              el.style.display = "none";
              return;
            }
            if (el.parentElement !== host) host.appendChild(el);
            // lado do caractere anterior: evita usar a caixa de textos decorativos (ex.: "Filtrar blocos…")
            const c = view.coordsAtPos(selection.head, selection.$head.parentOffset > 0 ? -1 : 1);
            const r = host.getBoundingClientRect();
            const zoom = host.offsetWidth ? r.width / host.offsetWidth : 1;
            // como no mock: a barra vai de 1em acima da linha de base até 0,2em abaixo
            // (a caixa da fonte fica 1/15 em mais baixa)
            const at = view.domAtPos(selection.head).node;
            const elAt = (at.nodeType === 3 ? at.parentElement : (at as HTMLElement)) ?? view.dom;
            const fontSize = parseFloat(getComputedStyle(elAt).fontSize) || 15;
            el.style.display = "block";
            el.style.left = `${(c.left - r.left) / zoom + 1}px`;
            el.style.top = `${(c.top - r.top) / zoom - fontSize / 15}px`;
            el.style.height = `${(c.bottom - c.top) / zoom}px`;
            // recomeça a piscar a cada movimento, como o cursor nativo
            el.classList.remove("blink");
            void el.offsetWidth;
            el.classList.add("blink");
          };
          // o DOM do editor já está atualizado quando o plugin é avisado: desenha na hora
          const schedule = () => {
            if (frame) cancelAnimationFrame(frame);
            draw();
          };
          const onResize = () => {
            if (!frame) frame = requestAnimationFrame(draw);
          };
          view.dom.addEventListener("focus", schedule);
          view.dom.addEventListener("blur", schedule);
          view.dom.addEventListener("compositionstart", schedule);
          view.dom.addEventListener("compositionend", schedule);
          window.addEventListener("resize", onResize);
          schedule();
          return {
            update: schedule,
            destroy() {
              if (frame) cancelAnimationFrame(frame);
              view.dom.removeEventListener("focus", schedule);
              view.dom.removeEventListener("blur", schedule);
              view.dom.removeEventListener("compositionstart", schedule);
              view.dom.removeEventListener("compositionend", schedule);
              window.removeEventListener("resize", onResize);
              el.remove();
            },
          };
        },
      }),
    ];
  },
});
