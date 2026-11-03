//! Zwischenablage für Geheimnisse.
//!
//! Unter Windows schreiben wir direkt über die Win32-API und setzen dabei die Formate,
//! mit denen Windows den Inhalt NICHT in den Zwischenablageverlauf (Win+V) und NICHT in die
//! Cloud-Zwischenablage übernimmt. Nach Ablauf der Zeit wird geleert – aber nur, wenn
//! inzwischen nichts anderes kopiert wurde (Sequenznummer unverändert).

#[cfg(windows)]
mod imp {
    use std::ptr;
    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::{GlobalFree, HANDLE, HGLOBAL, HWND};
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, GetClipboardSequenceNumber, OpenClipboard, RegisterClipboardFormatW,
        SetClipboardData,
    };
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
    use windows::Win32::System::Ole::CF_UNICODETEXT;

    /// Clipboard kurz öffnen; andere Programme halten es manchmal einige Millisekunden.
    fn open() -> Result<(), String> {
        for _ in 0..10 {
            if unsafe { OpenClipboard(HWND::default()) }.is_ok() {
                return Ok(());
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        Err("Die Zwischenablage ist gerade belegt. Bitte erneut versuchen.".into())
    }

    /// Bytes in globalen Speicher kopieren und unter `format` ablegen.
    unsafe fn set_bytes(format: u32, bytes: &[u8]) -> Result<(), String> {
        let hmem: HGLOBAL = GlobalAlloc(GMEM_MOVEABLE, bytes.len().max(1)).map_err(|e| e.message())?;
        let dst = GlobalLock(hmem) as *mut u8;
        if dst.is_null() {
            let _ = GlobalFree(hmem);
            return Err("Speicher für die Zwischenablage nicht verfügbar".into());
        }
        ptr::copy_nonoverlapping(bytes.as_ptr(), dst, bytes.len());
        let _ = GlobalUnlock(hmem);
        // Bei Erfolg gehört der Speicher dem System – nicht freigeben
        if SetClipboardData(format, HANDLE(hmem.0)).is_err() {
            let _ = GlobalFree(hmem);
            return Err("Zwischenablage konnte nicht gesetzt werden".into());
        }
        Ok(())
    }

    unsafe fn set_flag(name: PCWSTR, value: u32) {
        let format = RegisterClipboardFormatW(name);
        if format != 0 {
            let _ = set_bytes(format, &value.to_le_bytes());
        }
    }

    /// Text kopieren, ohne Verlauf/Cloud. Liefert die Sequenznummer danach.
    pub fn copy_secret(text: &str) -> Result<u32, String> {
        let mut utf16: Vec<u16> = text.encode_utf16().collect();
        utf16.push(0);
        let bytes: Vec<u8> = utf16.iter().flat_map(|c| c.to_le_bytes()).collect();

        open()?;
        let result = unsafe {
            (|| {
                EmptyClipboard().map_err(|e| e.message())?;
                set_bytes(CF_UNICODETEXT.0 as u32, &bytes)?;
                set_flag(w!("ExcludeClipboardContentFromMonitorProcessing"), 0);
                set_flag(w!("CanIncludeInClipboardHistory"), 0);
                set_flag(w!("CanUploadToCloudClipboard"), 0);
                Ok::<(), String>(())
            })()
        };
        unsafe {
            let _ = CloseClipboard();
        }
        result?;
        Ok(unsafe { GetClipboardSequenceNumber() })
    }

    /// Leeren, falls seit dem Kopieren nichts anderes in der Zwischenablage gelandet ist.
    pub fn clear_if_unchanged(sequence: u32) {
        if unsafe { GetClipboardSequenceNumber() } != sequence {
            return;
        }
        if open().is_ok() {
            unsafe {
                let _ = EmptyClipboard();
                let _ = CloseClipboard();
            }
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn copy_secret(_text: &str) -> Result<u32, String> {
        Err("Sicheres Kopieren gibt es nur unter Windows.".into())
    }
    pub fn clear_if_unchanged(_sequence: u32) {}
}

pub use imp::*;
