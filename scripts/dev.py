"""Run both services; stop them together on Ctrl+C or a process failure."""

from pathlib import Path
import os
import signal
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
PYTHON = (
    ROOT / "apps/api/.venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
)


def main():
    if not PYTHON.exists() or not (ROOT / "apps/web/node_modules").exists():
        raise SystemExit("Dependencies are missing. Run npm run setup first.")
    api_port = int(os.environ.get("API_PORT", "8000"))
    web_port = int(os.environ.get("WEB_PORT", "5173"))
    for port in (api_port, web_port):
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                raise SystemExit(
                    f"Cannot bind port {port}. Choose other ports with API_PORT / WEB_PORT, or check whether another service is running."
                )
    env = os.environ.copy()
    # Both services use absolute paths: never accidentally create separate SQLite databases.
    env.setdefault("DATABASE_URL", f"sqlite:///{ROOT / 'apps/api/patterns.db'}")
    env.setdefault("EXPORTS_DIR", str(ROOT / "apps/api/exports"))
    env.setdefault("EXPORT_MODE", "inline")
    env["VITE_API_PROXY_TARGET"] = f"http://127.0.0.1:{api_port}"
    processes = []

    def stop(*_):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop)
    try:
        processes.append(
            subprocess.Popen(
                [
                    str(PYTHON),
                    "-m",
                    "uvicorn",
                    "app.main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(api_port),
                ],
                cwd=ROOT / "apps/api",
                env=env,
            )
        )
        processes.append(
            subprocess.Popen(
                [
                    "npm",
                    "run",
                    "dev",
                    "--",
                    "--host",
                    "127.0.0.1",
                    "--strictPort",
                    "--port",
                    str(web_port),
                ],
                cwd=ROOT / "apps/web",
                env=env,
            )
        )
        print(
            f"\nStudio: http://localhost:{web_port}\nAPI docs: http://localhost:{api_port}/docs\nPress Ctrl+C to stop both services.\n",
            flush=True,
        )
        while all(p.poll() is None for p in processes):
            time.sleep(0.4)
        raise SystemExit("A service stopped. Check its output above.")
    except KeyboardInterrupt:
        pass
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    main()
