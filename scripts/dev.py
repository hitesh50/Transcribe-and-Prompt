#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT_DIR / "frontend"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the LocalRiskInsights backend and frontend together.",
    )
    parser.add_argument(
        "--backend-port",
        type=int,
        default=8000,
        help="Port for the FastAPI backend.",
    )
    parser.add_argument(
        "--frontend-port",
        type=int,
        default=5173,
        help="Port for the Vite dev server.",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host used by both dev servers.",
    )
    return parser.parse_args()


def ensure_prerequisites() -> None:
    if importlib.util.find_spec("uvicorn") is None:
        raise SystemExit(
            "Missing backend dependency 'uvicorn'. Run `pip install -e \".[dev]\"` first.",
        )

    npm_executable = resolve_npm_executable()
    if shutil.which(npm_executable) is None:
        raise SystemExit(
            "Could not find npm on PATH. Install Node.js 20+ before starting the dev stack.",
        )

    if not (FRONTEND_DIR / "node_modules").exists():
        raise SystemExit(
            "Frontend dependencies are missing. Run `cd frontend && npm install` first.",
        )


def resolve_npm_executable() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def spawn_process(command: list[str], cwd: Path) -> subprocess.Popen[bytes]:
    if os.name == "nt":
        return subprocess.Popen(
            command,
            cwd=cwd,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )

    return subprocess.Popen(
        command,
        cwd=cwd,
        start_new_session=True,
    )


def stop_process(process: subprocess.Popen[bytes], *, force: bool = False) -> None:
    if process.poll() is not None:
        return

    try:
        if os.name == "nt":
            if force:
                process.kill()
            else:
                process.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            target = os.getpgid(process.pid)
            os.killpg(target, signal.SIGKILL if force else signal.SIGTERM)
    except ProcessLookupError:
        return
    except OSError:
        if force:
            process.kill()


def wait_for_exit(processes: dict[str, subprocess.Popen[bytes]]) -> int:
    try:
        while True:
            for name, process in processes.items():
                exit_code = process.poll()
                if exit_code is not None:
                    if exit_code != 0:
                        print(f"{name} exited with code {exit_code}. Shutting down the remaining process.", file=sys.stderr)
                    return exit_code
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping LocalRiskInsights dev stack...")
        return 0


def shutdown(processes: dict[str, subprocess.Popen[bytes]]) -> None:
    for process in processes.values():
        stop_process(process, force=False)

    deadline = time.time() + 5
    while time.time() < deadline:
        if all(process.poll() is not None for process in processes.values()):
            return
        time.sleep(0.2)

    for process in processes.values():
        stop_process(process, force=True)


def main() -> int:
    args = parse_args()
    ensure_prerequisites()

    backend_command = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--host",
        args.host,
        "--port",
        str(args.backend_port),
    ]
    frontend_command = [
        resolve_npm_executable(),
        "run",
        "dev",
        "--",
        "--host",
        args.host,
        "--port",
        str(args.frontend_port),
    ]

    print("Starting LocalRiskInsights development stack...")
    print(f"Backend:  http://{args.host}:{args.backend_port}")
    print(f"Frontend: http://{args.host}:{args.frontend_port}")
    print("Press Ctrl+C to stop both processes.\n")

    processes = {
        "backend": spawn_process(backend_command, ROOT_DIR),
        "frontend": spawn_process(frontend_command, FRONTEND_DIR),
    }

    exit_code = wait_for_exit(processes)
    shutdown(processes)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())

