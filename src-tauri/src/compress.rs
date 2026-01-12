use brotli::CompressorWriter;
use std::fs::File;
use std::io::{self, Read, Write};
use std::path::Path;

const BROTLI_QUALITY: u32 = 9;
const BROTLI_WINDOW_SIZE: u32 = 22;
const BROTLI_BUFFER_SIZE: usize = 4096;

pub const COMPRESSED_EXTENSION: &str = "fsk"; // folish sketch (filename.fsk looks cute)

/// json -> compress -> write to a path
pub fn compress_to_file<P: AsRef<Path>>(path: P, content: &[u8]) -> io::Result<()> {
    let file = File::create(path)?;

    let mut compressor =
        CompressorWriter::new(file, BROTLI_BUFFER_SIZE, BROTLI_QUALITY, BROTLI_WINDOW_SIZE);

    compressor.write_all(content)?;
    compressor.flush()?;
    Ok(())
}

pub fn compress_to_file_str<P: AsRef<Path>>(path: P, content: &str) -> io::Result<()> {
    compress_to_file(path, content.as_bytes())
}

pub fn decompress_from_file<P: AsRef<Path>>(path: P) -> io::Result<String> {
    let file = File::open(path)?;

    let mut decompressor = brotli::Decompressor::new(file, BROTLI_BUFFER_SIZE);

    let mut output = String::new();
    decompressor.read_to_string(&mut output)?;

    Ok(output)
}
