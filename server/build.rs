use std::fs;
use std::path::Path;

fn main() {
    let migrations_dir = Path::new("migrations");
    println!("cargo:rerun-if-changed={}", migrations_dir.display());

    if let Ok(entries) = fs::read_dir(migrations_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) == Some("sql") {
                println!("cargo:rerun-if-changed={}", path.display());
            }
        }
    }
}
