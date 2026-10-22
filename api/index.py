"""Vercel serverless entry point. Vercel's Python runtime serves the WSGI `app`."""

import sys
from pathlib import Path

# the package lives in backend/src; make it importable without installing it
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend" / "src"))

from cellscope import create_app  # noqa: E402

app = create_app()
