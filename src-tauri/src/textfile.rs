//! Leitura e escrita de arquivos de texto preservando codificação e quebras de linha.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use encoding_rs::Encoding;
use serde::Serialize;

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileData {
    /// Conteúdo já decodificado, sempre com quebras de linha `\n`.
    pub content: String,
    /// "utf-8", "utf-8-bom", "utf-16le", "utf-16be" ou o nome WHATWG de uma codificação legada.
    pub encoding: String,
    /// "lf" ou "crlf".
    pub line_ending: String,
    pub mtime: u64,
    pub size: u64,
    /// Algum byte não pôde ser decodificado (foi trocado por U+FFFD).
    pub lossy: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileStat {
    pub mtime: u64,
    pub size: u64,
    pub encoding: String,
}

pub fn mtime_ms(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn decode(bytes: &[u8]) -> (String, String) {
    let (text, enc, _) = decode_checked(bytes);
    (text, enc)
}

/// Decodifica e informa se houve perda (bytes inválidos trocados por U+FFFD).
pub fn decode_checked(bytes: &[u8]) -> (String, String, bool) {
    if let Some(rest) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        let lossy = std::str::from_utf8(rest).is_err();
        return (String::from_utf8_lossy(rest).into_owned(), "utf-8-bom".into(), lossy);
    }
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let (text, _, errors) = encoding_rs::UTF_16LE.decode(bytes);
        return (text.into_owned(), "utf-16le".into(), errors);
    }
    if bytes.starts_with(&[0xFE, 0xFF]) {
        let (text, _, errors) = encoding_rs::UTF_16BE.decode(bytes);
        return (text.into_owned(), "utf-16be".into(), errors);
    }
    if let Ok(text) = std::str::from_utf8(bytes) {
        return (text.to_owned(), "utf-8".into(), false);
    }
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(bytes, true);
    let enc = detector.guess(Some(b"br"), true);
    let (text, _, errors) = enc.decode(bytes);
    (text.into_owned(), enc.name().to_ascii_lowercase(), errors)
}

/// Converte o texto para bytes na codificação pedida. Se a codificação legada
/// não conseguir representar algum caractere, cai para UTF-8 para não perder dados.
pub fn encode(text: &str, encoding: &str) -> (Vec<u8>, String) {
    match encoding {
        "utf-8" | "" => (text.as_bytes().to_vec(), "utf-8".into()),
        "utf-8-bom" => {
            let mut out = vec![0xEF, 0xBB, 0xBF];
            out.extend_from_slice(text.as_bytes());
            (out, "utf-8-bom".into())
        }
        "utf-16le" | "utf-16be" => {
            let le = encoding == "utf-16le";
            let mut out = if le { vec![0xFF, 0xFE] } else { vec![0xFE, 0xFF] };
            for unit in text.encode_utf16() {
                let b = if le { unit.to_le_bytes() } else { unit.to_be_bytes() };
                out.extend_from_slice(&b);
            }
            (out, encoding.into())
        }
        other => match Encoding::for_label(other.as_bytes()) {
            Some(enc) => {
                let (bytes, _, had_errors) = enc.encode(text);
                if had_errors {
                    (text.as_bytes().to_vec(), "utf-8".into())
                } else {
                    (bytes.into_owned(), other.into())
                }
            }
            None => (text.as_bytes().to_vec(), "utf-8".into()),
        },
    }
}

pub fn read(path: &Path) -> Result<FileData, String> {
    let bytes = fs::read(path).map_err(|e| format!("Não foi possível abrir {}: {e}", path.display()))?;
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    let (text, encoding, lossy) = decode_checked(&bytes);
    // CRLF só quando é o padrão do arquivo (evita converter um arquivo misto inteiro)
    let crlf = text.matches("\r\n").count();
    let lf = text.matches('\n').count() - crlf;
    let line_ending = if crlf > 0 && crlf >= lf { "crlf" } else { "lf" };
    let content = text.replace("\r\n", "\n");
    Ok(FileData {
        content,
        encoding,
        line_ending: line_ending.into(),
        mtime: mtime_ms(&meta),
        size: meta.len(),
        lossy,
    })
}

/// Resolve links simbólicos para escrever no arquivo de verdade.
fn real_target(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

/// Erro devolvido quando o arquivo no disco não é mais a versão que o app leu.
pub const CONFLICT: &str = "CONFLITO";

/// Escrita atômica: grava num arquivo temporário na mesma pasta e renomeia.
pub fn write(path: &Path, content: &str, encoding: &str, line_ending: &str) -> Result<FileStat, String> {
    write_checked(path, content, encoding, line_ending, None)
}

/// Como `write`, mas recusa gravar se o arquivo mudou (ou sumiu) desde `expected_mtime`.
pub fn write_checked(
    path: &Path,
    content: &str,
    encoding: &str,
    line_ending: &str,
    expected_mtime: Option<u64>,
) -> Result<FileStat, String> {
    let target = real_target(path);
    if let Some(expected) = expected_mtime {
        match fs::metadata(&target) {
            Ok(meta) if mtime_ms(&meta) != expected => {
                return Err(format!("{CONFLICT}: o arquivo foi alterado fora do Blocos"));
            }
            Err(_) => return Err(format!("{CONFLICT}: o arquivo não existe mais no disco")),
            _ => {}
        }
    }
    let normalized = content.replace("\r\n", "\n");
    let text = if line_ending == "crlf" { normalized.replace('\n', "\r\n") } else { normalized };
    let (bytes, used_encoding) = encode(&text, encoding);

    let dir = target.parent().ok_or("Caminho inválido")?;
    if !dir.exists() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let name = target.file_name().and_then(|n| n.to_str()).unwrap_or("arquivo");
    let tmp = dir.join(format!(".{name}.blocos-tmp"));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| format!("Não foi possível salvar: {e}"))?;
        f.write_all(&bytes).map_err(|e| e.to_string())?;
        f.sync_all().ok();
    }
    if let Ok(old) = fs::metadata(&target) {
        fs::set_permissions(&tmp, old.permissions()).ok();
    }
    fs::rename(&tmp, &target).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("Não foi possível salvar: {e}")
    })?;
    let meta = fs::metadata(&target).map_err(|e| e.to_string())?;
    Ok(FileStat { mtime: mtime_ms(&meta), size: meta.len(), encoding: used_encoding })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf8_roundtrip_keeps_crlf() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("a.txt");
        fs::write(&p, b"linha 1\r\nlinha 2\r\n").unwrap();
        let data = read(&p).unwrap();
        assert_eq!(data.content, "linha 1\nlinha 2\n");
        assert_eq!(data.line_ending, "crlf");
        assert_eq!(data.encoding, "utf-8");
        write(&p, &(data.content + "linha 3\n"), &data.encoding, &data.line_ending).unwrap();
        assert_eq!(fs::read(&p).unwrap(), b"linha 1\r\nlinha 2\r\nlinha 3\r\n");
    }

    #[test]
    fn latin1_is_detected_and_preserved() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("b.txt");
        // "Observação: atenção" em windows-1252
        let (bytes, _, _) = encoding_rs::WINDOWS_1252.encode("Observação: atenção e coração\n");
        fs::write(&p, &bytes).unwrap();
        let data = read(&p).unwrap();
        assert_eq!(data.content, "Observação: atenção e coração\n");
        assert_eq!(data.encoding, "windows-1252");
        let stat = write(&p, "Ação\n", &data.encoding, "lf").unwrap();
        assert_eq!(stat.encoding, "windows-1252");
        assert_eq!(fs::read(&p).unwrap(), encoding_rs::WINDOWS_1252.encode("Ação\n").0.to_vec());
    }

    #[test]
    fn refuses_to_overwrite_external_changes() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("sync.md");
        fs::write(&p, "v1").unwrap();
        let read1 = read(&p).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(&p, "versão do celular").unwrap();
        let err = write_checked(&p, "minha versão", "utf-8", "lf", Some(read1.mtime)).unwrap_err();
        assert!(err.starts_with(CONFLICT));
        assert_eq!(fs::read_to_string(&p).unwrap(), "versão do celular");
        // com a data certa grava normalmente
        let now = read(&p).unwrap().mtime;
        write_checked(&p, "ok", "utf-8", "lf", Some(now)).unwrap();
        assert_eq!(fs::read_to_string(&p).unwrap(), "ok");
        // arquivo apagado: não recria sozinho
        fs::remove_file(&p).unwrap();
        assert!(write_checked(&p, "x", "utf-8", "lf", Some(now)).is_err());
        assert!(!p.exists());
    }

    #[test]
    fn reports_lossy_decoding() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("bom.txt");
        fs::write(&p, b"\xEF\xBB\xBFok \xFF\xFE fim").unwrap();
        assert!(read(&p).unwrap().lossy);
        fs::write(&p, "tudo certo").unwrap();
        assert!(!read(&p).unwrap().lossy);
    }

    #[test]
    fn mixed_line_endings_keep_majority() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("misto.txt");
        fs::write(&p, "a\nb\nc\r\nd\n").unwrap();
        assert_eq!(read(&p).unwrap().line_ending, "lf");
    }

    #[test]
    fn unmappable_chars_fall_back_to_utf8() {
        let (bytes, enc) = encode("emoji 🙂", "windows-1252");
        assert_eq!(enc, "utf-8");
        assert_eq!(bytes, "emoji 🙂".as_bytes());
    }

    #[test]
    fn bom_is_kept() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("c.md");
        fs::write(&p, b"\xEF\xBB\xBF# T\n").unwrap();
        let data = read(&p).unwrap();
        assert_eq!(data.encoding, "utf-8-bom");
        assert_eq!(data.content, "# T\n");
        write(&p, "# U\n", &data.encoding, "lf").unwrap();
        assert_eq!(fs::read(&p).unwrap(), b"\xEF\xBB\xBF# U\n");
    }

    #[cfg(unix)]
    #[test]
    fn write_goes_through_symlink() {
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real.md");
        let link = dir.path().join("link.md");
        fs::write(&real, "a").unwrap();
        std::os::unix::fs::symlink(&real, &link).unwrap();
        write(&link, "b", "utf-8", "lf").unwrap();
        assert!(fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert_eq!(fs::read_to_string(&real).unwrap(), "b");
    }
}
