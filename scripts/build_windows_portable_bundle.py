#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT_DIR / "dist"
BUNDLE_NAME = "LocalRiskInsights-Windows-Portable"
BUNDLE_DIR = DIST_DIR / BUNDLE_NAME
ARCHIVE_BASE = DIST_DIR / BUNDLE_NAME
FRONTEND_DIR = ROOT_DIR / "frontend"
FRONTEND_DIST_DIR = FRONTEND_DIR / "dist"

PYTHON_EMBED_URL = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"
PIP_ZIPAPP_URL = "https://bootstrap.pypa.io/pip/pip.pyz"
FFMPEG_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"

BACKEND_DIRS = ["app", "data"]
BACKEND_FILES = [
    ".env.example",
    "LICENSE",
    "README.md",
    "config.yaml",
]
PORTABLE_WINDOWS_FILES = {
    "Launch-LocalRiskInsights-Portable.bat": "Launch-LocalRiskInsights-Portable.bat",
    "Launch-LocalRiskInsights-Portable.ps1": "Launch-LocalRiskInsights-Portable.ps1",
    "Stop-LocalRiskInsights-Portable.bat": "Stop-LocalRiskInsights-Portable.bat",
    "Stop-LocalRiskInsights-Portable.ps1": "Stop-LocalRiskInsights-Portable.ps1",
    "START-HERE-PORTABLE.txt": "START-HERE.txt",
}
EXCLUDED_NAMES = {
    "__pycache__",
    ".DS_Store",
    ".gitkeep",
}
EXCLUDED_SUFFIXES = {
    ".pyc",
    ".pyo",
    ".pyd",
}


def should_ignore(path: Path) -> bool:
    return any(part in EXCLUDED_NAMES for part in path.parts) or path.suffix in EXCLUDED_SUFFIXES


def clean_dist() -> None:
    if BUNDLE_DIR.exists():
        shutil.rmtree(BUNDLE_DIR)
    zip_path = DIST_DIR / f"{BUNDLE_NAME}.zip"
    if zip_path.exists():
        zip_path.unlink()
    DIST_DIR.mkdir(exist_ok=True)


def ensure_frontend_build() -> None:
    if not FRONTEND_DIST_DIR.exists():
        raise SystemExit(
            "frontend/dist is missing. Run `npm install` and `npm run build` in the frontend first.",
        )


def copy_tree(relative_dir: str) -> None:
    source_dir = ROOT_DIR / relative_dir
    target_dir = BUNDLE_DIR / relative_dir

    for path in source_dir.rglob("*"):
        if should_ignore(path):
            continue
        destination = target_dir / path.relative_to(source_dir)
        if path.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, destination)


def copy_backend_files() -> None:
    for relative_file in BACKEND_FILES:
        source = ROOT_DIR / relative_file
        destination = BUNDLE_DIR / relative_file
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    requirements_source = ROOT_DIR / "portable" / "requirements-windows.txt"
    shutil.copy2(requirements_source, BUNDLE_DIR / "requirements-windows.txt")


def copy_windows_launchers() -> None:
    source_root = ROOT_DIR / "windows-portable"
    for source_name, destination_name in PORTABLE_WINDOWS_FILES.items():
        shutil.copy2(source_root / source_name, BUNDLE_DIR / destination_name)


def stage_static_frontend() -> None:
    static_dir = BUNDLE_DIR / "app" / "static"
    if static_dir.exists():
        shutil.rmtree(static_dir)
    shutil.copytree(FRONTEND_DIST_DIR, static_dir)


def download_file(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url}")
    with urllib.request.urlopen(url) as response, destination.open("wb") as handle:
        shutil.copyfileobj(response, handle)


def download_payloads() -> None:
    payload_dir = BUNDLE_DIR / "payload"
    download_file(PYTHON_EMBED_URL, payload_dir / "python-3.11.9-embed-amd64.zip")
    download_file(PIP_ZIPAPP_URL, payload_dir / "pip.pyz")
    download_file(FFMPEG_URL, payload_dir / "ffmpeg-release-essentials.zip")


def download_wheelhouse() -> None:
    wheelhouse_dir = BUNDLE_DIR / "payload" / "wheelhouse"
    wheelhouse_dir.mkdir(parents=True, exist_ok=True)
    requirements_file = ROOT_DIR / "portable" / "requirements-windows.txt"
    command = [
        "python3",
        "-m",
        "pip",
        "download",
        "--dest",
        str(wheelhouse_dir),
        "--only-binary=:all:",
        "--platform",
        "win_amd64",
        "--implementation",
        "cp",
        "--python-version",
        "311",
        "--abi",
        "cp311",
        "-r",
        str(requirements_file),
    ]
    subprocess.run(command, check=True, cwd=ROOT_DIR)


def write_package_note() -> None:
    note = (
        "This portable bundle is for Windows users who do not want Docker Desktop.\n"
        "Use START-HERE.txt and then double-click Launch-LocalRiskInsights-Portable.bat.\n"
    )
    (BUNDLE_DIR / "PACKAGE-NOTE.txt").write_text(note, encoding="utf-8")


def build_bundle() -> Path:
    clean_dist()
    ensure_frontend_build()
    BUNDLE_DIR.mkdir(parents=True, exist_ok=True)

    copy_backend_files()
    for directory in BACKEND_DIRS:
        copy_tree(directory)

    stage_static_frontend()
    copy_windows_launchers()
    download_payloads()
    download_wheelhouse()
    write_package_note()

    archive_path = shutil.make_archive(str(ARCHIVE_BASE), "zip", root_dir=DIST_DIR, base_dir=BUNDLE_NAME)
    return Path(archive_path)


def main() -> int:
    archive_path = build_bundle()
    print(f"Created Windows portable bundle: {archive_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
