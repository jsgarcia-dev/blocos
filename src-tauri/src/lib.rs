mod library;
mod textfile;

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use library::{Backups, FolderEntry, SearchHit};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use textfile::{FileData, FileStat};

struct LaunchPaths(Mutex<Vec<String>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppDirs {
    documents: Option<String>,
    home: Option<String>,
    data: String,
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Converte argumentos de linha de comando em caminhos absolutos de arquivos existentes.
fn paths_from_args(args: &[String], cwd: &Path) -> Vec<String> {
    args.iter()
        .filter(|a| !a.starts_with('-'))
        .map(|a| a.strip_prefix("file://").unwrap_or(a))
        .map(|a| {
            let p = Path::new(a);
            if p.is_absolute() { p.to_path_buf() } else { cwd.join(p) }
        })
        .filter(|p| p.is_file())
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

#[tauri::command]
fn read_text_file(path: String) -> Result<FileData, String> {
    textfile::read(Path::new(&path))
}

#[tauri::command]
fn write_text_file(
    backups: State<'_, Backups>,
    path: String,
    content: String,
    encoding: String,
    line_ending: String,
    expected_mtime: Option<u64>,
) -> Result<FileStat, String> {
    let p = Path::new(&path);
    if expected_mtime.is_some() {
        // confere antes de copiar para o backup: em conflito nada é tocado
        if let Ok(meta) = std::fs::metadata(p) {
            if Some(textfile::mtime_ms(&meta)) != expected_mtime {
                return Err(format!("{}: o arquivo foi alterado fora do Blocos", textfile::CONFLICT));
            }
        }
    }
    backups.backup_once(p);
    textfile::write_checked(p, &content, &encoding, &line_ending, expected_mtime)
}

#[tauri::command]
fn file_stat(path: String) -> Option<FileStat> {
    let meta = std::fs::metadata(&path).ok()?;
    if !meta.is_file() {
        return None;
    }
    Some(FileStat { mtime: textfile::mtime_ms(&meta), size: meta.len(), encoding: String::new() })
}

#[tauri::command]
async fn list_folder(path: String) -> Result<FolderEntry, String> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err(format!("Pasta não encontrada: {path}"));
    }
    tauri::async_runtime::spawn_blocking(move || library::list_folder(&p, 5))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_files(folders: Vec<String>, extra_files: Vec<String>, query: String) -> Result<Vec<SearchHit>, String> {
    tauri::async_runtime::spawn_blocking(move || library::search(&folders, &extra_files, &query, 40))
        .await
        .map_err(|e| e.to_string())
}

fn doc_dir_of(doc_path: &Option<String>) -> Option<PathBuf> {
    doc_path.as_ref().and_then(|p| Path::new(p).parent().map(Path::to_path_buf))
}

#[tauri::command]
fn import_image(app: AppHandle, src: String, doc_path: Option<String>) -> Result<String, String> {
    let bytes = std::fs::read(&src).map_err(|e| e.to_string())?;
    let name = Path::new(&src).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "imagem.png".into());
    let fallback = data_dir(&app)?.join("imagens");
    library::store_image(&bytes, &name, doc_dir_of(&doc_path).as_deref(), &fallback)
}

#[tauri::command]
fn save_image_bytes(app: AppHandle, bytes: Vec<u8>, name: String, doc_path: Option<String>) -> Result<String, String> {
    let fallback = data_dir(&app)?.join("imagens");
    library::store_image(&bytes, &name, doc_dir_of(&doc_path).as_deref(), &fallback)
}

#[tauri::command]
fn load_state(app: AppHandle, name: String) -> Result<Option<String>, String> {
    let file = data_dir(&app)?.join(format!("{name}.json"));
    match std::fs::read_to_string(&file) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn save_state(app: AppHandle, name: String, data: String) -> Result<(), String> {
    let file = data_dir(&app)?.join(format!("{name}.json"));
    textfile::write(&file, &data, "utf-8", "lf").map(|_| ())
}

#[tauri::command]
fn take_launch_paths(state: State<'_, LaunchPaths>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

#[tauri::command]
fn app_dirs(app: AppHandle) -> Result<AppDirs, String> {
    let p = app.path();
    Ok(AppDirs {
        documents: p.document_dir().ok().map(|d| d.to_string_lossy().into_owned()),
        home: p.home_dir().ok().map(|d| d.to_string_lossy().into_owned()),
        data: data_dir(&app)?.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn print_page(window: WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cwd = std::env::current_dir().unwrap_or_default();
    let initial = paths_from_args(&args, &cwd);

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let paths = paths_from_args(&argv.into_iter().skip(1).collect::<Vec<_>>(), Path::new(&cwd));
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
            if !paths.is_empty() {
                let _ = app.emit("open-paths", paths);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
        .manage(LaunchPaths(Mutex::new(initial)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build(),
                )?;
            }
            let backups = Backups::new(data_dir(app.handle())?.join("backups"));
            backups.prune(30);
            app.manage(backups);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            file_stat,
            list_folder,
            search_files,
            import_image,
            save_image_bytes,
            load_state,
            save_state,
            take_launch_paths,
            app_dirs,
            print_page
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Blocos");
}
