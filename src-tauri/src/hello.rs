//! Windows Hello über KeyCredentialManager.
//!
//! Windows Hello erzeugt einen RSA-Schlüssel im TPM, der nur nach PIN/Fingerabdruck/Gesicht
//! benutzt werden kann. Der Tresor lässt ihn eine feste Challenge signieren; die Signatur ist
//! deterministisch (RSA PKCS#1 v1.5) und daraus wird der Schlüssel zum Entsperren abgeleitet.
//! Ohne diesen Hardware-Schlüssel lässt sich die Hello-Hülle nicht öffnen.

#[cfg(windows)]
mod imp {
    use std::time::Duration;
    use windows::core::{w, Array, HSTRING, PCWSTR};
    use windows::Security::Credentials::{
        KeyCredential, KeyCredentialCreationOption, KeyCredentialManager, KeyCredentialStatus,
    };
    use windows::Security::Cryptography::CryptographicBuffer;
    use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, SetForegroundWindow};

    const CREDENTIAL_NAME: &str = "Tresor (de.coregenetic.tresor)";

    fn err(e: windows::core::Error) -> String {
        format!("Windows Hello: {}", e.message())
    }

    fn status_message(status: KeyCredentialStatus) -> String {
        match status {
            KeyCredentialStatus::UserCanceled => "Windows Hello wurde abgebrochen.".into(),
            KeyCredentialStatus::UserPrefersPassword => "Bitte mit dem Master-Passwort entsperren.".into(),
            KeyCredentialStatus::NotFound => {
                "Der Windows-Hello-Schlüssel wurde nicht gefunden. Bitte mit dem Master-Passwort entsperren und Windows Hello neu einrichten.".into()
            }
            KeyCredentialStatus::SecurityDeviceLocked => {
                "Das Sicherheitsmodul ist gesperrt. Bitte später erneut versuchen oder das Master-Passwort nutzen.".into()
            }
            _ => "Windows Hello ist fehlgeschlagen.".into(),
        }
    }

    /// Der Hello-Dialog öffnet sich bei Desktop-Apps manchmal hinter dem Fenster.
    /// Wir holen ihn kurz nach dem Öffnen in den Vordergrund.
    fn bring_dialog_to_front() {
        std::thread::spawn(|| {
            for _ in 0..40 {
                std::thread::sleep(Duration::from_millis(75));
                unsafe {
                    if let Ok(hwnd) = FindWindowW(w!("Credential Dialog Xaml Host"), PCWSTR::null()) {
                        if !hwnd.is_invalid() {
                            let _ = SetForegroundWindow(hwnd);
                            return;
                        }
                    }
                }
            }
        });
    }

    fn sign(credential: &KeyCredential, challenge: &[u8]) -> Result<Vec<u8>, String> {
        let buffer = CryptographicBuffer::CreateFromByteArray(challenge).map_err(err)?;
        bring_dialog_to_front();
        let result = credential.RequestSignAsync(&buffer).map_err(err)?.get().map_err(err)?;
        let status = result.Status().map_err(err)?;
        if status != KeyCredentialStatus::Success {
            return Err(status_message(status));
        }
        let signed = result.Result().map_err(err)?;
        let mut bytes = Array::<u8>::new();
        CryptographicBuffer::CopyToByteArray(&signed, &mut bytes).map_err(err)?;
        Ok(bytes.to_vec())
    }

    pub fn is_supported() -> bool {
        KeyCredentialManager::IsSupportedAsync()
            .and_then(|op| op.get())
            .unwrap_or(false)
    }

    /// Neuen Hello-Schlüssel anlegen (ersetzt einen alten) und die Challenge signieren.
    pub fn create_and_sign(challenge: &[u8]) -> Result<Vec<u8>, String> {
        bring_dialog_to_front();
        let created = KeyCredentialManager::RequestCreateAsync(
            &HSTRING::from(CREDENTIAL_NAME),
            KeyCredentialCreationOption::ReplaceExisting,
        )
        .map_err(err)?
        .get()
        .map_err(err)?;
        let status = created.Status().map_err(err)?;
        if status != KeyCredentialStatus::Success {
            return Err(status_message(status));
        }
        let credential = created.Credential().map_err(err)?;
        sign(&credential, challenge)
    }

    /// Vorhandenen Hello-Schlüssel öffnen und die Challenge signieren.
    pub fn open_and_sign(challenge: &[u8]) -> Result<Vec<u8>, String> {
        let opened = KeyCredentialManager::OpenAsync(&HSTRING::from(CREDENTIAL_NAME))
            .map_err(err)?
            .get()
            .map_err(err)?;
        let status = opened.Status().map_err(err)?;
        if status != KeyCredentialStatus::Success {
            return Err(status_message(status));
        }
        let credential = opened.Credential().map_err(err)?;
        sign(&credential, challenge)
    }

    pub fn delete() {
        if let Ok(op) = KeyCredentialManager::DeleteAsync(&HSTRING::from(CREDENTIAL_NAME)) {
            let _ = op.get();
        }
    }
}

#[cfg(not(windows))]
mod imp {
    const UNSUPPORTED: &str = "Windows Hello gibt es nur unter Windows.";

    pub fn is_supported() -> bool {
        false
    }
    pub fn create_and_sign(_challenge: &[u8]) -> Result<Vec<u8>, String> {
        Err(UNSUPPORTED.into())
    }
    pub fn open_and_sign(_challenge: &[u8]) -> Result<Vec<u8>, String> {
        Err(UNSUPPORTED.into())
    }
    pub fn delete() {}
}

pub use imp::*;
