const SEP = /[\\/]/;

export function basename(path: string): string {
  const parts = path.split(SEP).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (i <= 0) return i === 0 ? path.slice(0, 1) : "";
  return path.slice(0, i);
}

export function extname(path: string): string {
  const name = basename(path);
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function stripExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

export function joinPath(dir: string, rel: string): string {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  const parts = (dir.replace(/[\\/]+$/, "") + sep + rel).split(SEP);
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return out.join(sep);
}

export function isAbsolute(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\");
}

/** Mostra caminhos dentro da pasta pessoal como `~/…`. */
export function prettyPath(path: string, home: string | null): string {
  if (home && path.startsWith(home)) return "~" + path.slice(home.length);
  return path;
}

export function kindOf(path: string): "md" | "txt" {
  return extname(path) === "txt" ? "txt" : "md";
}
