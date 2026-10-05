"""Browser tests get their own services, database and export directory."""

import os
import tempfile
from pathlib import Path
from dev import main

if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="lps-browser-") as folder:
        os.environ.update(
            {
                "API_PORT": "18000",
                "WEB_PORT": "15173",
                "EXPORT_MODE": "inline",
                "DATABASE_URL": f"sqlite:///{Path(folder) / 'patterns.db'}",
                "EXPORTS_DIR": str(Path(folder) / "exports"),
            }
        )
        main()
