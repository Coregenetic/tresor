mod clipboard;
mod hello;
mod vault;

use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager, State, WindowEvent};
use vault::{Key, VaultFile};

/// Entsperrter Zustand: Datei + Schlüssel nur im Arbeitsspeicher, wird beim Sperren verworfen.
struct Session {
    file: VaultFile,
    key: Key,
}

struct AppState {
    path: PathBuf,
    session: Mutex<Option<Session>>,
    /// Beim Minimieren sperren (Einstellung, vom Frontend nach dem Entsperren gesetzt)
    lock_on_minimize: AtomicBool,
    /// Sequenznummer der Zwischenablage nach unserem letzten Kopieren
    clipboard_seq: Mutex<Option<u32>>,
}

impl AppState {
    /// Sperren: Schlüssel verwerfen und eigene Zwischenablage-Inhalte entfernen.
    fn lock_now(&self) {
        *self.session.lock().unwrap() = None;
        if let Some(seq) = self.clipboard_seq.lock().unwrap().take() {
            clipboard::clear_if_unchanged(seq);
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Status {
    exists: bool,
    unlocked: bool,
    hello_supported: bool,
    hello_enabled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateResult {
    hello_enabled: bool,
    hello_error: Option<String>,
}

type CmdResult<T> = Result<T, String>;

fn load_file(path: &Path) -> CmdResult<VaultFile> {
    let json = fs::read_to_string(path).map_err(|e| format!("Tresor-Datei nicht lesbar: {e}"))?;
    VaultFile::parse(&json).map_err(|e| e.to_string())
}

/// Atomar speichern: erst in .tmp schreiben, alte Version als .bak behalten, dann umbenennen.
fn save_file(path: &Path, file: &VaultFile) -> CmdResult<()> {
    let tmp = path.with_extension("json.tmp");
    let bak = path.with_extension("json.bak");
    fs::write(&tmp, file.to_json()).map_err(|e| format!("Speichern fehlgeschlagen: {e}"))?;
    if path.exists() {
        let _ = fs::copy(path, &bak);
    }
    fs::rename(&tmp, path).map_err(|e| format!("Speichern fehlgeschlagen: {e}"))
}

fn data_bytes(data: &Value) -> CmdResult<Vec<u8>> {
    if !data.is_object() {
        return Err("Ungültige Daten".into());
    }
    serde_json::to_vec(data).map_err(|e| e.to_string())
}

fn data_value(file: &VaultFile, key: &Key) -> CmdResult<Value> {
    let bytes = file.read_data(key).map_err(|e| e.to_string())?;
    serde_json::from_slice(&bytes).map_err(|_| "Tresor-Inhalt beschädigt".into())
}

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> CmdResult<T> + Send + 'static) -> CmdResult<T> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| format!("Interner Fehler: {e}"))?
}

#[tauri::command]
async fn vault_status(state: State<'_, AppState>) -> CmdResult<Status> {
    let exists = state.path.exists();
    let hello_enabled = exists && load_file(&state.path).map(|f| f.hello.is_some()).unwrap_or(false);
    let unlocked = state.session.lock().unwrap().is_some();
    let hello_supported = blocking(|| Ok(hello::is_supported())).await?;
    Ok(Status { exists, unlocked, hello_supported, hello_enabled })
}

#[tauri::command]
async fn vault_create(
    state: State<'_, AppState>,
    password: String,
    data: Value,
    enable_hello: bool,
) -> CmdResult<CreateResult> {
    if state.path.exists() {
        return Err("Es gibt bereits einen Tresor.".into());
    }
    if password.chars().count() < 10 {
        return Err("Das Master-Passwort muss mindestens 10 Zeichen haben.".into());
    }
    let bytes = data_bytes(&data)?;
    let (mut file, key) = blocking(move || VaultFile::create(&password, &bytes).map_err(|e| e.to_string())).await?;
    save_file(&state.path, &file)?;

    let mut hello_error = None;
    if enable_hello {
        let challenge = VaultFile::new_hello_challenge();
        let c = challenge.clone();
        match blocking(move || hello::create_and_sign(&c)).await {
            Ok(signature) => {
                file.enable_hello(&key, &challenge, &signature).map_err(|e| e.to_string())?;
                save_file(&state.path, &file)?;
            }
            Err(e) => hello_error = Some(e),
        }
    }
    let hello_enabled = file.hello.is_some();
    *state.session.lock().unwrap() = Some(Session { file, key });
    Ok(CreateResult { hello_enabled, hello_error })
}

#[tauri::command]
async fn vault_unlock_password(state: State<'_, AppState>, password: String) -> CmdResult<Value> {
    let file = load_file(&state.path)?;
    let (file, key) = blocking(move || match file.unlock_with_password(&password) {
        Ok(key) => Ok((file, key)),
        Err(e) => {
            // kleine Bremse gegen schnelles Durchprobieren
            std::thread::sleep(Duration::from_millis(600));
            Err(e.to_string())
        }
    })
    .await?;
    let data = data_value(&file, &key)?;
    *state.session.lock().unwrap() = Some(Session { file, key });
    Ok(data)
}

#[tauri::command]
async fn vault_unlock_hello(state: State<'_, AppState>) -> CmdResult<Value> {
    let file = load_file(&state.path)?;
    let challenge = file.hello_challenge().map_err(|e| e.to_string())?;
    let signature = blocking(move || hello::open_and_sign(&challenge)).await?;
    let key = file.unlock_with_hello(&signature).map_err(|e| e.to_string())?;
    let data = data_value(&file, &key)?;
    *state.session.lock().unwrap() = Some(Session { file, key });
    Ok(data)
}

#[tauri::command]
fn vault_lock(state: State<'_, AppState>) {
    // Drop → Schlüssel wird durch Zeroizing überschrieben
    state.lock_now();
}

#[tauri::command]
fn set_lock_on_minimize(state: State<'_, AppState>, enabled: bool) {
    state.lock_on_minimize.store(enabled, Ordering::Relaxed);
}

/// Geheimnis kopieren (ohne Windows-Verlauf) und nach `clear_after_secs` wieder entfernen.
#[tauri::command]
fn copy_secret(app: tauri::AppHandle, state: State<'_, AppState>, text: String, clear_after_secs: u64) -> CmdResult<()> {
    if state.session.lock().unwrap().is_none() {
        return Err("Der Tresor ist gesperrt.".into());
    }
    let seq = clipboard::copy_secret(&text)?;
    *state.clipboard_seq.lock().unwrap() = Some(seq);
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(clear_after_secs.clamp(5, 600)));
        clipboard::clear_if_unchanged(seq);
        let state = app.state::<AppState>();
        let mut current = state.clipboard_seq.lock().unwrap();
        if *current == Some(seq) {
            *current = None;
        }
    });
    Ok(())
}

/// Verschlüsseltes Backup mit eigenem Backup-Passwort schreiben.
#[tauri::command]
async fn vault_export(state: State<'_, AppState>, path: String, password: String) -> CmdResult<()> {
    if password.chars().count() < 10 {
        return Err("Das Backup-Passwort muss mindestens 10 Zeichen haben.".into());
    }
    let data = {
        let guard = state.session.lock().unwrap();
        let s = guard.as_ref().ok_or("Der Tresor ist gesperrt.")?;
        s.file.read_data(&s.key).map_err(|e| e.to_string())?
    };
    let backup = blocking(move || VaultFile::create(&password, &data).map(|(f, _)| f).map_err(|e| e.to_string())).await?;
    fs::write(&path, backup.to_json()).map_err(|e| format!("Backup konnte nicht gespeichert werden: {e}"))
}

/// Backup-Datei entschlüsseln und Inhalt zurückgeben (das Zusammenführen macht das Frontend).
#[tauri::command]
async fn vault_import_read(state: State<'_, AppState>, path: String, password: String) -> CmdResult<Value> {
    if state.session.lock().unwrap().is_none() {
        return Err("Der Tresor ist gesperrt.".into());
    }
    let json = fs::read_to_string(&path).map_err(|e| format!("Datei nicht lesbar: {e}"))?;
    let file = VaultFile::parse(&json).map_err(|_| "Das ist keine gültige Tresor-Backup-Datei.".to_string())?;
    blocking(move || {
        let key = file.unlock_with_password(&password).map_err(|_| {
            std::thread::sleep(Duration::from_millis(600));
            "Falsches Backup-Passwort".to_string()
        })?;
        data_value(&file, &key)
    })
    .await
}

#[tauri::command]
fn vault_save(state: State<'_, AppState>, data: Value) -> CmdResult<()> {
    let bytes = data_bytes(&data)?;
    let mut guard = state.session.lock().unwrap();
    let session = guard.as_mut().ok_or("Der Tresor ist gesperrt.")?;
    session.file.write_data(&session.key, &bytes).map_err(|e| e.to_string())?;
    save_file(&state.path, &session.file)
}

#[tauri::command]
async fn vault_enable_hello(state: State<'_, AppState>) -> CmdResult<()> {
    if state.session.lock().unwrap().is_none() {
        return Err("Der Tresor ist gesperrt.".into());
    }
    let challenge = VaultFile::new_hello_challenge();
    let c = challenge.clone();
    let signature = blocking(move || hello::create_and_sign(&c)).await?;
    let mut guard = state.session.lock().unwrap();
    let session = guard.as_mut().ok_or("Der Tresor ist gesperrt.")?;
    session
        .file
        .enable_hello(&session.key, &challenge, &signature)
        .map_err(|e| e.to_string())?;
    save_file(&state.path, &session.file)
}

#[tauri::command]
fn vault_disable_hello(state: State<'_, AppState>) -> CmdResult<()> {
    let mut guard = state.session.lock().unwrap();
    let session = guard.as_mut().ok_or("Der Tresor ist gesperrt.")?;
    session.file.disable_hello();
    save_file(&state.path, &session.file)?;
    hello::delete();
    Ok(())
}

#[tauri::command]
async fn vault_change_password(state: State<'_, AppState>, current: String, next: String) -> CmdResult<()> {
    if next.chars().count() < 10 {
        return Err("Das neue Master-Passwort muss mindestens 10 Zeichen haben.".into());
    }
    let file = state
        .session
        .lock()
        .unwrap()
        .as_ref()
        .map(|s| s.file.clone())
        .ok_or("Der Tresor ist gesperrt.")?;
    // aktuelles Passwort prüfen, bevor es ersetzt wird
    blocking(move || file.unlock_with_password(&current).map(|_| ()).map_err(|e| e.to_string())).await?;

    let (mut file, key) = {
        let guard = state.session.lock().unwrap();
        let s = guard.as_ref().ok_or("Der Tresor ist gesperrt.")?;
        (s.file.clone(), s.key.clone())
    };
    let file = blocking(move || {
        file.change_password(&key, &next).map_err(|e| e.to_string())?;
        Ok(file)
    })
    .await?;
    save_file(&state.path, &file)?;
    if let Some(s) = state.session.lock().unwrap().as_mut() {
        s.file = file;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            fs::create_dir_all(&dir)?;
            app.manage(AppState {
                path: dir.join("tresor.json"),
                session: Mutex::new(None),
                lock_on_minimize: AtomicBool::new(true),
                clipboard_seq: Mutex::new(None),
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            // Beim Minimieren sofort sperren – im Rust-Kern, damit der Schlüssel sicher weg ist
            if let WindowEvent::Resized(_) = event {
                if window.is_minimized().unwrap_or(false) {
                    let state = window.state::<AppState>();
                    let unlocked = state.session.lock().unwrap().is_some();
                    if unlocked && state.lock_on_minimize.load(Ordering::Relaxed) {
                        state.lock_now();
                        let _ = window.emit("vault-locked", ());
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            vault_status,
            vault_create,
            vault_unlock_password,
            vault_unlock_hello,
            vault_lock,
            vault_save,
            vault_enable_hello,
            vault_disable_hello,
            vault_change_password,
            set_lock_on_minimize,
            copy_secret,
            vault_export,
            vault_import_read,
        ])
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten von Tresor");
}
