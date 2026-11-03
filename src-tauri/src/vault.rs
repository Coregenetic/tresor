//! Tresor-Datei und Verschlüsselung.
//!
//! Aufbau:
//! - Ein zufälliger 256-Bit-Tresorschlüssel verschlüsselt die eigentlichen Daten (AES-256-GCM).
//! - Dieser Schlüssel liegt mehrfach "eingepackt" in der Datei:
//!   * mit dem Master-Passwort (Argon2id → AES-256-GCM)
//!   * optional mit Windows Hello (TPM-Signatur → SHA-256 → AES-256-GCM)
//! - Ohne Master-Passwort oder Windows Hello ist die Datei nicht lesbar.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

pub type Key = Zeroizing<[u8; 32]>;

const AAD_PASSWORD: &[u8] = b"tresor:wrap:password:v1";
const AAD_HELLO: &[u8] = b"tresor:wrap:hello:v1";
const AAD_DATA: &[u8] = b"tresor:data:v1";

/// Argon2id-Parameter: 64 MiB, 3 Durchläufe – auf einem aktuellen PC ca. 0,3–0,6 s.
const KDF_M_KIB: u32 = 64 * 1024;
const KDF_T: u32 = 3;
const KDF_P: u32 = 1;

#[derive(Debug, thiserror::Error)]
pub enum VaultError {
    #[error("Falsches Master-Passwort")]
    WrongPassword,
    #[error("Windows Hello konnte den Tresor nicht entsperren")]
    HelloMismatch,
    #[error("Windows Hello ist für diesen Tresor nicht eingerichtet")]
    HelloNotEnabled,
    #[error("Die Tresor-Datei ist beschädigt")]
    Corrupt,
    #[error("Die Tresor-Datei hat eine unbekannte Version")]
    UnsupportedVersion,
    #[error("Interner Fehler: {0}")]
    Internal(String),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Sealed {
    pub nonce: String,
    pub ct: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct KdfParams {
    pub alg: String,
    pub salt: String,
    pub m_kib: u32,
    pub t: u32,
    pub p: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HelloWrap {
    /// Zufällige Challenge, die der Windows-Hello-Schlüssel signiert
    pub challenge: String,
    pub wrapped: Sealed,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VaultFile {
    pub version: u32,
    pub kdf: KdfParams,
    pub wrapped_password: Sealed,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hello: Option<HelloWrap>,
    pub data: Sealed,
}

fn random<const N: usize>() -> [u8; N] {
    let mut b = [0u8; N];
    OsRng.fill_bytes(&mut b);
    b
}

fn decode(s: &str) -> Result<Vec<u8>, VaultError> {
    B64.decode(s).map_err(|_| VaultError::Corrupt)
}

fn seal(key: &[u8; 32], plain: &[u8], aad: &[u8]) -> Result<Sealed, VaultError> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| VaultError::Internal(e.to_string()))?;
    let nonce = random::<12>();
    let ct = cipher
        .encrypt(Nonce::from_slice(&nonce), Payload { msg: plain, aad })
        .map_err(|_| VaultError::Internal("Verschlüsselung fehlgeschlagen".into()))?;
    Ok(Sealed { nonce: B64.encode(nonce), ct: B64.encode(ct) })
}

fn open(key: &[u8; 32], sealed: &Sealed, aad: &[u8]) -> Option<Zeroizing<Vec<u8>>> {
    let cipher = Aes256Gcm::new_from_slice(key).ok()?;
    let nonce = B64.decode(&sealed.nonce).ok()?;
    if nonce.len() != 12 {
        return None;
    }
    let ct = B64.decode(&sealed.ct).ok()?;
    cipher
        .decrypt(Nonce::from_slice(&nonce), Payload { msg: &ct, aad })
        .ok()
        .map(Zeroizing::new)
}

fn to_key(bytes: &[u8]) -> Result<Key, VaultError> {
    let arr: [u8; 32] = bytes.try_into().map_err(|_| VaultError::Corrupt)?;
    Ok(Zeroizing::new(arr))
}

fn derive_password_key(password: &str, kdf: &KdfParams) -> Result<Key, VaultError> {
    if kdf.alg != "argon2id" {
        return Err(VaultError::UnsupportedVersion);
    }
    let salt = decode(&kdf.salt)?;
    let params = Params::new(kdf.m_kib, kdf.t, kdf.p, Some(32)).map_err(|e| VaultError::Internal(e.to_string()))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut out = Zeroizing::new([0u8; 32]);
    argon
        .hash_password_into(password.as_bytes(), &salt, out.as_mut())
        .map_err(|e| VaultError::Internal(e.to_string()))?;
    Ok(out)
}

/// Aus der (deterministischen) Windows-Hello-Signatur einen Schlüssel ableiten.
pub fn derive_hello_key(signature: &[u8]) -> Key {
    let mut h = Sha256::new();
    h.update(b"tresor-hello-key-v1");
    h.update(signature);
    let digest = h.finalize();
    let mut out = Zeroizing::new([0u8; 32]);
    out.copy_from_slice(&digest);
    out
}

impl VaultFile {
    /// Neuen Tresor mit Master-Passwort und Startdaten anlegen.
    pub fn create(password: &str, data_json: &[u8]) -> Result<(VaultFile, Key), VaultError> {
        let kdf = KdfParams {
            alg: "argon2id".into(),
            salt: B64.encode(random::<16>()),
            m_kib: KDF_M_KIB,
            t: KDF_T,
            p: KDF_P,
        };
        let vault_key: Key = Zeroizing::new(random::<32>());
        let pw_key = derive_password_key(password, &kdf)?;
        let wrapped_password = seal(&pw_key, vault_key.as_ref(), AAD_PASSWORD)?;
        let data = seal(&vault_key, data_json, AAD_DATA)?;
        Ok((VaultFile { version: 1, kdf, wrapped_password, hello: None, data }, vault_key))
    }

    pub fn parse(json: &str) -> Result<VaultFile, VaultError> {
        let file: VaultFile = serde_json::from_str(json).map_err(|_| VaultError::Corrupt)?;
        if file.version != 1 {
            return Err(VaultError::UnsupportedVersion);
        }
        Ok(file)
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).expect("Serialisierung kann nicht fehlschlagen")
    }

    pub fn unlock_with_password(&self, password: &str) -> Result<Key, VaultError> {
        let pw_key = derive_password_key(password, &self.kdf)?;
        let raw = open(&pw_key, &self.wrapped_password, AAD_PASSWORD).ok_or(VaultError::WrongPassword)?;
        to_key(&raw)
    }

    pub fn hello_challenge(&self) -> Result<Vec<u8>, VaultError> {
        let hello = self.hello.as_ref().ok_or(VaultError::HelloNotEnabled)?;
        decode(&hello.challenge)
    }

    pub fn unlock_with_hello(&self, signature: &[u8]) -> Result<Key, VaultError> {
        let hello = self.hello.as_ref().ok_or(VaultError::HelloNotEnabled)?;
        let hello_key = derive_hello_key(signature);
        let raw = open(&hello_key, &hello.wrapped, AAD_HELLO).ok_or(VaultError::HelloMismatch)?;
        to_key(&raw)
    }

    /// Neue Challenge für die Hello-Einrichtung erzeugen (vor dem Signieren aufrufen).
    pub fn new_hello_challenge() -> Vec<u8> {
        random::<32>().to_vec()
    }

    pub fn enable_hello(&mut self, vault_key: &Key, challenge: &[u8], signature: &[u8]) -> Result<(), VaultError> {
        let hello_key = derive_hello_key(signature);
        let wrapped = seal(&hello_key, vault_key.as_ref(), AAD_HELLO)?;
        self.hello = Some(HelloWrap { challenge: B64.encode(challenge), wrapped });
        Ok(())
    }

    pub fn disable_hello(&mut self) {
        self.hello = None;
    }

    pub fn change_password(&mut self, vault_key: &Key, new_password: &str) -> Result<(), VaultError> {
        self.kdf.salt = B64.encode(random::<16>());
        let pw_key = derive_password_key(new_password, &self.kdf)?;
        self.wrapped_password = seal(&pw_key, vault_key.as_ref(), AAD_PASSWORD)?;
        Ok(())
    }

    pub fn read_data(&self, vault_key: &Key) -> Result<Zeroizing<Vec<u8>>, VaultError> {
        open(vault_key, &self.data, AAD_DATA).ok_or(VaultError::Corrupt)
    }

    pub fn write_data(&mut self, vault_key: &Key, data_json: &[u8]) -> Result<(), VaultError> {
        self.data = seal(vault_key, data_json, AAD_DATA)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DATA: &[u8] = br#"{"members":[],"entries":[{"title":"Telekom"}]}"#;

    #[test]
    fn password_roundtrip() {
        let (file, key) = VaultFile::create("korrekt-pferd-batterie", DATA).unwrap();
        let parsed = VaultFile::parse(&file.to_json()).unwrap();
        let key2 = parsed.unlock_with_password("korrekt-pferd-batterie").unwrap();
        assert_eq!(key.as_ref(), key2.as_ref());
        assert_eq!(parsed.read_data(&key2).unwrap().as_slice(), DATA);
    }

    #[test]
    fn wrong_password_fails() {
        let (file, _) = VaultFile::create("richtig", DATA).unwrap();
        assert!(matches!(file.unlock_with_password("falsch"), Err(VaultError::WrongPassword)));
    }

    #[test]
    fn hello_roundtrip_and_mismatch() {
        let (mut file, key) = VaultFile::create("pw", DATA).unwrap();
        let challenge = VaultFile::new_hello_challenge();
        let signature = b"simulierte-deterministische-signatur";
        file.enable_hello(&key, &challenge, signature).unwrap();
        let parsed = VaultFile::parse(&file.to_json()).unwrap();
        assert_eq!(parsed.hello_challenge().unwrap(), challenge);
        let key2 = parsed.unlock_with_hello(signature).unwrap();
        assert_eq!(key.as_ref(), key2.as_ref());
        assert!(matches!(parsed.unlock_with_hello(b"andere"), Err(VaultError::HelloMismatch)));
    }

    #[test]
    fn data_update_and_password_change() {
        let (mut file, key) = VaultFile::create("alt", DATA).unwrap();
        file.write_data(&key, b"{\"neu\":true}").unwrap();
        file.change_password(&key, "neu").unwrap();
        assert!(file.unlock_with_password("alt").is_err());
        let key2 = file.unlock_with_password("neu").unwrap();
        assert_eq!(file.read_data(&key2).unwrap().as_slice(), b"{\"neu\":true}");
    }

    #[test]
    fn tampering_is_detected() {
        let (mut file, key) = VaultFile::create("pw", DATA).unwrap();
        let mut ct = B64.decode(&file.data.ct).unwrap();
        ct[0] ^= 1;
        file.data.ct = B64.encode(ct);
        assert!(matches!(file.read_data(&key), Err(VaultError::Corrupt)));
    }
}
