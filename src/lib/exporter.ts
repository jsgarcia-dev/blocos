import docCss from "../styles/doc.css?raw";
import { handles } from "./handles";
import { platform } from "./platform";
import { dirname, joinPath, stripExt, basename } from "./paths";
import { activeTab, getState, toast } from "../store/store";
import { tabTitle } from "../store/actions";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Gera um .html independente com o visual do documento. */
export async function exportHtml() {
  const tab = activeTab();
  const editor = tab ? handles.get(tab.id)?.editor : undefined;
  if (!tab || !editor) return;
  const title = tabTitle(tab);
  const base = tab.path ? dirname(tab.path) : (getState().documents ?? "");
  const name = tab.path ? stripExt(basename(tab.path)) : title;
  const dest = await platform().saveDialog(joinPath(base, `${name}.html`), [{ name: "Página HTML", extensions: ["html"] }]);
  if (!dest) return;
  const body = editor.getHTML();
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{--ink:#17171A;--ink2:#4F4F58;--mu:#9C9CA6;--ln:#E6E3DC;--ac:#FF5A1F;--acs:#FFEFE6;--page:#fff;--chip:#F4F3EF;--code-bg:#1F1F23}
body{margin:0;background:#F2F0EA;font-family:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif;color:var(--ink)}
.sheet{max-width:740px;margin:24px auto;background:#fff;border-radius:16px;padding:34px 66px 48px;box-shadow:0 0 0 1px var(--ln)}
details.toggle-block>div,details>div{padding-left:4px}
${docCss}
</style>
</head>
<body><div class="sheet"><div class="doc">${body}</div></div></body>
</html>
`;
  try {
    await platform().writeTextFile(/\.html?$/i.test(dest) ? dest : `${dest}.html`, html, "utf-8", "lf");
    toast(`Exportado: ${basename(dest)}`);
  } catch (e) {
    toast(String(e), "erro");
  }
}
