fn main() {
    // tauri-build ajoute déjà le manifeste aux binaires de l'application.
    // Les options manuelles ci-dessous créaient un doublon (CVT1100).
    // if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
    //     println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    //     println!("cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
    // }
    tauri_build::build()
}