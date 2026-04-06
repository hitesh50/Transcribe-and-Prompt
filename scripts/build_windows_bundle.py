#!/usr/bin/env python3
from __future__ import annotations

import shutil
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT_DIR / "dist"
BUNDLE_NAME = "LocalRiskInsights-Windows"
BUNDLE_DIR = DIST_DIR / BUNDLE_NAME
ARCHIVE_BASE = DIST_DIR / BUNDLE_NAME

DIRECTORIES_TO_COPY = [
    "app",
    "data",
    "frontend",
    "windows",
]

FILES_TO_COPY = [
    ".dockerignore",
    ".env.example",
    ".gitignore",
    "Dockerfile",
    "LICENSE",
    "README.md",
    "config.yaml",
    "docker-compose.yml",
    "pyproject.toml",
]

EXCLUDED_NAMES = {
    ".git",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
    "dist",
    "localriskinsights.egg-info",
    ".DS_Store",
}

EXCLUDED_SUFFIXES = {
    ".pyc",
    ".pyo",
    ".pyd",
    ".tsbuildinfo",
}

WINDOWS_FILES = {
    "Launch-LocalRiskInsights.bat": "Launch-LocalRiskInsights.bat",
    "Launch-LocalRiskInsights.ps1": "Launch-LocalRiskInsights.ps1",
    "Stop-LocalRiskInsights.bat": "Stop-LocalRiskInsights.bat",
    "Stop-LocalRiskInsights.ps1": "Stop-LocalRiskInsights.ps1",
    "START-HERE-WINDOWS.txt": "START-HERE.txt",
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


def copy_tree(relative_dir: str) -> None:
    source_dir = ROOT_DIR / relative_dir
    target_dir = BUNDLE_DIR / relative_dir

    for path in source_dir.rglob("*"):
        if should_ignore(path):
            continue
        relative_path = path.relative_to(source_dir)
        destination = target_dir / relative_path
        if path.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, destination)


def copy_files() -> None:
    for relative_file in FILES_TO_COPY:
        source = ROOT_DIR / relative_file
        destination = BUNDLE_DIR / relative_file
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def expose_windows_launchers() -> None:
    for source_name, destination_name in WINDOWS_FILES.items():
        source = BUNDLE_DIR / "windows" / source_name
        destination = BUNDLE_DIR / destination_name
        shutil.copy2(source, destination)


def write_package_note() -> None:
    note = (
        "This bundle is ready for Windows users who want the Docker-first launch path.\n"
        "Use START-HERE.txt and then double-click Launch-LocalRiskInsights.bat.\n"
    )
    (BUNDLE_DIR / "PACKAGE-NOTE.txt").write_text(note, encoding="utf-8")


def build_bundle() -> Path:
    clean_dist()
    BUNDLE_DIR.mkdir(parents=True, exist_ok=True)

    copy_files()
    for directory in DIRECTORIES_TO_COPY:
        copy_tree(directory)

    expose_windows_launchers()
    write_package_note()

    archive_path = shutil.make_archive(str(ARCHIVE_BASE), "zip", root_dir=DIST_DIR, base_dir=BUNDLE_NAME)
    return Path(archive_path)


def main() -> int:
    archive_path = build_bundle()
    print(f"Created Windows bundle: {archive_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
