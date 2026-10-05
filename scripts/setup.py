"""Install project dependencies from the repository root. No global installs."""

from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
VENV = ROOT / "apps/api/.venv"
PYTHON = VENV / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")


def main():
    if sys.version_info < (3, 11):
        raise SystemExit("Python 3.11 or newer is required.")
    if not shutil.which("npm"):
        raise SystemExit("Install Node.js 22.12+ (with npm) first.")
    if not PYTHON.exists():
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)
    subprocess.run(
        [str(PYTHON), "-m", "pip", "install", "-r", "requirements-dev.txt"],
        cwd=ROOT / "apps/api",
        check=True,
    )
    for folder in [ROOT, ROOT / "packages/ui", ROOT / "apps/web"]:
        subprocess.run(["npm", "ci", "--no-audit", "--no-fund"], cwd=folder, check=True)
    print("\nReady. Run npm run dev, then open http://localhost:5173")


if __name__ == "__main__":
    main()
