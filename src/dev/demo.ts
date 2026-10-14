/**
 * Só em desenvolvimento, com "?demo=mock": deixa a tela no mesmo estado do mock
 * aprovado (menu "/" aberto depois das seções, alça sobre "Banco Alfa").
 */
import { handles } from "../lib/handles";
import { getState, setState, updateTab } from "../store/store";

export async function setupMockDemo() {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // captura determinística: sem animações (como na captura do mock)
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}";
  document.head.appendChild(style);
  for (let i = 0; i < 50 && !handles.get(getState().activeId ?? "")?.editor; i++) await wait(100);
  const ed = handles.get(getState().activeId ?? "")?.editor;
  if (!ed) return;
  const lastPosition = getState().library.lastPosition;
  // parágrafo com "/" logo depois da última seção recolhível
  const end = ed.state.doc.content.size;
  let at = end;
  ed.state.doc.forEach((n, pos) => {
    if (n.type.name === "paragraph" && n.childCount === 0 && pos + n.nodeSize === end) at = pos;
  });
  ed.chain().insertContentAt(at, { type: "paragraph", content: [{ type: "text", text: "/" }] }).setTextSelection(at + 2).focus().run();
  await wait(300);
  // alça e destaque sobre "Banco Alfa"
  const h2 = document.querySelector<HTMLElement>(".pane.active .ProseMirror h2");
  const sheet = document.querySelector<HTMLElement>(".pane.active .sheet");
  if (h2 && sheet) {
    const r = h2.getBoundingClientRect();
    sheet.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: r.left + 40, clientY: r.top + 10 }));
  }
  // no mock o documento aparece salvo e o cartão mostra a posição da sessão anterior
  await wait(900);
  const id = getState().activeId!;
  updateTab(id, { dirty: false, status: "saved", lastEdited: null });
  ed.view.dispatch(ed.state.tr.setMeta("demo", true));
  setState((s) => ({ library: { ...s.library, lastPosition } }));
  document.documentElement.dataset.demoReady = "1";
}
