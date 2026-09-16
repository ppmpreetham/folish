use brotli::CompressorWriter;
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::Path;

const BROTLI_QUALITY: u32 = 9;
const BROTLI_WINDOW_SIZE: u32 = 22;
const BROTLI_BUFFER_SIZE: usize = 4096;

pub const PROJECT_EXTENSION: &str = "flsh"; // folish but without vowels (filename.fsk looks cute but idk)

/// json -> compress -> write to a path
pub fn compress_to_file<P: AsRef<Path>>(path: P, content: &[u8]) -> io::Result<()> {
    let file = File::create(path)?;

    let mut compressor =
        CompressorWriter::new(file, BROTLI_BUFFER_SIZE, BROTLI_QUALITY, BROTLI_WINDOW_SIZE);

    compressor.write_all(content)?;
    compressor.flush()?;
    Ok(())
}

pub fn decompress_from_file<P: AsRef<Path>>(path: P) -> io::Result<String> {
    let file = File::open(path)?;
    let mut decompressor = brotli::Decompressor::new(file, BROTLI_BUFFER_SIZE);

    let mut output = String::new();
    decompressor.read_to_string(&mut output)?;

    Ok(output)
}

/// extracts the embedded thumbnail PNG from a .flsh document as raw bytes.
/// Shared by the OS thumbnail shims (CLI on Linux/Windows COM DLL).
pub fn extract_thumbnail<P: AsRef<Path>>(path: P) -> io::Result<Vec<u8>> {
    let json = decompress_from_file(path)?;
    let doc: serde_json::Value =
        serde_json::from_str(&json).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    let data_url = doc["meta"]["thumbnail"]
        .as_str()
        .and_then(|s| s.strip_prefix("data:image/png;base64,"))
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no embedded thumbnail"))?;

    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(data_url)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

/// Atomic save: compress to `<name>.flsh.tmp`, then rename over the real file.
/// A crash mid-save leaves a stale-but-valid file, never a half-written one.
pub fn compress_to_file_atomic<P: AsRef<Path>>(path: P, content: &[u8]) -> io::Result<()> {
    let path = path.as_ref();
    let mut tmp = path.as_os_str().to_os_string();
    tmp.push(".tmp");

    compress_to_file(&tmp, content)?;
    fs::rename(&tmp, path)
}
