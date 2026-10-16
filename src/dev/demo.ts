/**
 * Só em desenvolvimento, com "?demo=mock": deixa a tela no mesmo estado do mock
 * aprovado — menu "/" aberto depois das seções,
 * desfazer e refazer disponíveis, negrito ativo e o documento com o mesmo
 * tamanho do mock (18 registros, 1.284 palavras; o restante fica abaixo da área visível).
 */
import { handles } from "../lib/handles";
import { countWords } from "../lib/format";
import { getState, setState, updateTab } from "../store/store";

export async function setupMockDemo() {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // captura determinística: sem animações (como na captura do mock)
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}";
  document.head.appendChild(style);
  // o mock tem a coluna centralizada, o espaçamento compacto e o fundo pontilhado
  setState((s) => ({
    library: {
      ...s.library,
      prefs: { ...s.library.prefs, editorAlign: "centro", editorWidth: "normal", lineSpacing: "compacto", letterSpacing: "normal", background: "pontos", marginTop: 52, marginSide: 66 },
    },
  }));
  for (let i = 0; i < 50 && !handles.get(getState().activeId ?? "")?.editor; i++) await wait(100);
  const ed = handles.get(getState().activeId ?? "")?.editor;
  if (!ed) return;
  const lastPosition = getState().library.lastPosition;

  // resto do documento (abaixo do que aparece no mock): mais 1 registro e texto até 1.284 palavras
  const words = countWords(ed.state.doc.textBetween(0, ed.state.doc.content.size, " ", " "));
  const shortBlocks = [
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "AG13 extra" }] }] }] },
    ...["Notas", "Pendências", "Contatos", "Resumo", "Anexos"].map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
  ];
  const used = 2 + 5;
  let missing = 1284 - words - used;
  const filler: object[] = [];
  const sentence = "anotação de acompanhamento do cliente com prazo e responsável definidos ".split(" ").filter(Boolean);
  while (missing > 0) {
    const n = Math.min(80, missing);
    const text = Array.from({ length: n }, (_, i) => sentence[i % sentence.length]).join(" ");
    filler.push({ type: "paragraph", content: [{ type: "text", text }] });
    missing -= n;
  }
  ed.chain()
    .command(({ tr }) => {
      tr.setMeta("addToHistory", false);
      return true;
    })
    .insertContentAt(ed.state.doc.content.size, [...shortBlocks, ...filler])
    .run();

  // parágrafo com "/" logo depois da última seção recolhível
  let at = -1;
  ed.state.doc.forEach((n, pos) => {
    if (n.type.name === "details") at = pos + n.nodeSize;
  });
  ed.chain().insertContentAt(at, { type: "paragraph", content: [{ type: "text", text: "/" }] }).setTextSelection(at + 2).focus().run();
  // desfazer e refazer disponíveis (como no mock): uma ação desfeita
  await wait(700);
  ed.chain().insertContent("x").run();
  await wait(50);
  ed.commands.undo();
  await wait(300);

  // no mock o documento aparece salvo e o cartão mostra a posição da sessão anterior
  await wait(900);
  const id = getState().activeId!;
  updateTab(id, { dirty: false, status: "saved", lastEdited: null });
  setState((s) => ({ library: { ...s.library, lastPosition } }));
  const canvas = document.querySelector<HTMLElement>(".pane.active .canvas");
  if (canvas) canvas.scrollTop = 0;
  // negrito ativo para o próximo texto (Ctrl+B antes de digitar)
  ed.view.focus();
  ed.commands.setMark("bold");
  ed.view.dispatch(ed.state.tr.setMeta("demo", true));
  await wait(100);
  document.documentElement.dataset.demoReady = "1";
}
