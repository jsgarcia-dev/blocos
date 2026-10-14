//! Pastas, busca em arquivos, imagens e cópias de segurança.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;

const TEXT_EXTS: [&str; 3] = ["md", "markdown", "txt"];
const SKIP_DIRS: [&str; 6] = ["node_modules", "target", ".git", "dist", "build", "__pycache__"];

pub fn is_text_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| TEXT_EXTS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.starts_with('.'))
        .unwrap_or(false)
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FolderEntry {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub children: Vec<FolderEntry>,
    /// Quantidade de arquivos de texto dentro (recursivo) — só para pastas.
    pub count: usize,
}

pub fn list_folder(root: &Path, max_depth: usize) -> FolderEntry {
    fn walk(dir: &Path, depth: usize, max_depth: usize) -> (Vec<FolderEntry>, usize) {
        let mut dirs = Vec::new();
        let mut files = Vec::new();
        let mut total = 0;
        let Ok(read) = fs::read_dir(dir) else { return (vec![], 0) };
        for entry in read.flatten() {
            let path = entry.path();
            if is_hidden(&path) {
                continue;
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            let Ok(ft) = entry.file_type() else { continue };
            if ft.is_dir() {
                if SKIP_DIRS.contains(&name.as_str()) || depth >= max_depth {
                    continue;
                }
                let (children, count) = walk(&path, depth + 1, max_depth);
                if count > 0 {
                    total += count;
                    dirs.push(FolderEntry { path: path.to_string_lossy().into(), name, is_dir: true, children, count });
                }
            } else if is_text_file(&path) {
                total += 1;
                files.push(FolderEntry { path: path.to_string_lossy().into(), name, is_dir: false, children: vec![], count: 0 });
            }
        }
        let key = |e: &FolderEntry| e.name.to_lowercase();
        dirs.sort_by_key(key);
        files.sort_by_key(key);
        dirs.extend(files);
        (dirs, total)
    }
    let (children, count) = walk(root, 0, max_depth);
    FolderEntry {
        path: root.to_string_lossy().into(),
        name: root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| root.to_string_lossy().into()),
        is_dir: true,
        children,
        count,
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub name: String,
    pub name_match: bool,
    /// Número da linha (1-based) do primeiro trecho encontrado no conteúdo.
    pub line: Option<usize>,
    pub snippet: Option<String>,
}

/// Normaliza para comparação: minúsculas e sem acentos comuns do português.
pub fn fold(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' | 'Á' | 'À' | 'Â' | 'Ã' | 'Ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' | 'Í' | 'Ì' | 'Î' | 'Ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' | 'Ó' | 'Ò' | 'Ô' | 'Õ' | 'Ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' | 'Ú' | 'Ù' | 'Û' | 'Ü' => 'u',
            'ç' | 'Ç' => 'c',
            other => other.to_lowercase().next().unwrap_or(other),
        })
        .collect()
}

fn collect_files(root: &Path, out: &mut Vec<PathBuf>, depth: usize, limit: usize) {
    if depth > 6 || out.len() >= limit {
        return;
    }
    let Ok(read) = fs::read_dir(root) else { return };
    for entry in read.flatten() {
        let path = entry.path();
        if is_hidden(&path) {
            continue;
        }
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_dir() {
            let name = entry.file_name();
            if !SKIP_DIRS.contains(&name.to_string_lossy().as_ref()) {
                collect_files(&path, out, depth + 1, limit);
            }
        } else if is_text_file(&path) {
            out.push(path);
            if out.len() >= limit {
                return;
            }
        }
    }
}

pub fn search(folders: &[String], extra_files: &[String], query: &str, max_hits: usize) -> Vec<SearchHit> {
    let q = fold(query.trim());
    if q.is_empty() {
        return vec![];
    }
    let mut files: Vec<PathBuf> = extra_files.iter().map(PathBuf::from).collect();
    for f in folders {
        collect_files(Path::new(f), &mut files, 0, 3000);
    }
    let mut seen = HashSet::new();
    files.retain(|p| seen.insert(p.clone()));

    let mut name_hits = Vec::new();
    let mut content_hits = Vec::new();
    for path in files {
        let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        let name_match = fold(&name).contains(&q);
        let mut line = None;
        let mut snippet = None;
        if let Ok(meta) = fs::metadata(&path) {
            if meta.len() <= 4 * 1024 * 1024 {
                if let Ok(bytes) = fs::read(&path) {
                    let (text, _) = crate::textfile::decode(&bytes);
                    for (i, l) in text.lines().enumerate() {
                        if fold(l).contains(&q) {
                            line = Some(i + 1);
                            let trimmed: String = l.trim().chars().take(160).collect();
                            snippet = Some(trimmed);
                            break;
                        }
                    }
                }
            }
        }
        if !name_match && line.is_none() {
            continue;
        }
        let hit = SearchHit { path: path.to_string_lossy().into(), name, name_match, line, snippet };
        if name_match { name_hits.push(hit) } else { content_hits.push(hit) }
        if name_hits.len() + content_hits.len() >= max_hits * 2 {
            break;
        }
    }
    name_hits.extend(content_hits);
    name_hits.truncate(max_hits);
    name_hits
}

/// Gera um nome livre dentro de `dir` a partir de `name` (acrescenta -1, -2…).
pub fn free_name(dir: &Path, name: &str) -> PathBuf {
    let p = Path::new(name);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("imagem");
    let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("png");
    let mut candidate = dir.join(format!("{stem}.{ext}"));
    let mut i = 1;
    while candidate.exists() {
        candidate = dir.join(format!("{stem}-{i}.{ext}"));
        i += 1;
    }
    candidate
}

/// Guarda a imagem na pasta `imagens/` ao lado do documento e devolve o
/// caminho para usar no Markdown (relativo quando há documento).
pub fn store_image(bytes: &[u8], file_name: &str, doc_dir: Option<&Path>, fallback_dir: &Path) -> Result<String, String> {
    let dir = match doc_dir {
        Some(d) => d.join("imagens"),
        None => fallback_dir.to_path_buf(),
    };
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let target = free_name(&dir, file_name);
    fs::write(&target, bytes).map_err(|e| e.to_string())?;
    Ok(match doc_dir {
        Some(_) => format!("imagens/{}", target.file_name().unwrap().to_string_lossy()),
        None => target.to_string_lossy().into_owned(),
    })
}

/// Cópias de segurança: na primeira vez que um arquivo é sobrescrito em cada
/// execução, a versão anterior vai para a pasta de backups.
pub struct Backups {
    pub dir: PathBuf,
    done: Mutex<HashSet<PathBuf>>,
}

impl Backups {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir, done: Mutex::new(HashSet::new()) }
    }

    pub fn backup_once(&self, path: &Path) {
        let Ok(mut done) = self.done.lock() else { return };
        if done.contains(path) || !path.exists() {
            return;
        }
        if fs::create_dir_all(&self.dir).is_err() {
            return;
        }
        let stamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S");
        let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        // o caminho completo entra no nome para dois "notas.md" de pastas diferentes não colidirem
        let mut h = std::collections::hash_map::DefaultHasher::new();
        std::hash::Hash::hash(&path, &mut h);
        let tag = format!("{:08x}", std::hash::Hasher::finish(&h) as u32);
        if fs::copy(path, self.dir.join(format!("{stamp}__{tag}__{name}"))).is_ok() {
            done.insert(path.to_path_buf());
        }
    }

    /// Remove backups com mais de `days` dias.
    pub fn prune(&self, days: u64) {
        let Ok(read) = fs::read_dir(&self.dir) else { return };
        let limit = std::time::Duration::from_secs(days * 24 * 3600);
        for entry in read.flatten() {
            if let Ok(meta) = entry.metadata() {
                if let Ok(age) = meta.modified().map(|m| m.elapsed().unwrap_or_default()) {
                    if age > limit {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_only_text_files_and_counts() {
        let d = tempfile::tempdir().unwrap();
        fs::create_dir_all(d.path().join("sub/vazia")).unwrap();
        fs::create_dir_all(d.path().join("node_modules")).unwrap();
        fs::write(d.path().join("a.md"), "x").unwrap();
        fs::write(d.path().join("b.png"), "x").unwrap();
        fs::write(d.path().join("sub/c.txt"), "x").unwrap();
        fs::write(d.path().join("node_modules/d.md"), "x").unwrap();
        fs::write(d.path().join(".oculto.md"), "x").unwrap();
        let tree = list_folder(d.path(), 4);
        assert_eq!(tree.count, 2);
        let names: Vec<_> = tree.children.iter().map(|c| c.name.clone()).collect();
        assert_eq!(names, vec!["sub", "a.md"]);
    }

    #[test]
    fn search_finds_names_and_content_ignoring_accents() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("Reunião.md"), "nada aqui").unwrap();
        fs::write(d.path().join("notas.md"), "linha um\nATENÇÃO: reuniao amanhã\n").unwrap();
        let hits = search(&[d.path().to_string_lossy().into()], &[], "reuniao", 10);
        assert_eq!(hits.len(), 2);
        assert!(hits[0].name_match);
        assert_eq!(hits[1].line, Some(2));
        assert_eq!(hits[1].snippet.as_deref(), Some("ATENÇÃO: reuniao amanhã"));
    }

    #[test]
    fn images_get_unique_relative_names() {
        let d = tempfile::tempdir().unwrap();
        let a = store_image(b"1", "foto.png", Some(d.path()), d.path()).unwrap();
        let b = store_image(b"2", "foto.png", Some(d.path()), d.path()).unwrap();
        assert_eq!(a, "imagens/foto.png");
        assert_eq!(b, "imagens/foto-1.png");
    }

    #[test]
    fn backup_happens_once_per_file() {
        let d = tempfile::tempdir().unwrap();
        let f = d.path().join("x.md");
        fs::write(&f, "v1").unwrap();
        let b = Backups::new(d.path().join("bk"));
        b.backup_once(&f);
        fs::write(&f, "v2").unwrap();
        b.backup_once(&f);
        let files: Vec<_> = fs::read_dir(d.path().join("bk")).unwrap().flatten().collect();
        assert_eq!(files.len(), 1);
        assert_eq!(fs::read_to_string(files[0].path()).unwrap(), "v1");
    }

    #[test]
    fn same_name_in_different_folders_gets_separate_backups() {
        let d = tempfile::tempdir().unwrap();
        fs::create_dir_all(d.path().join("a")).unwrap();
        fs::create_dir_all(d.path().join("b")).unwrap();
        fs::write(d.path().join("a/notas.md"), "A").unwrap();
        fs::write(d.path().join("b/notas.md"), "B").unwrap();
        let b = Backups::new(d.path().join("bk"));
        b.backup_once(&d.path().join("a/notas.md"));
        b.backup_once(&d.path().join("b/notas.md"));
        assert_eq!(fs::read_dir(d.path().join("bk")).unwrap().count(), 2);
    }
}
