#!/usr/bin/env python3
import uvicorn
import sys
import os
import logging

# Base directory (where run_backend.py is located, i.e. share/)
base_dir = os.path.dirname(os.path.abspath(__file__))

# Backend package directory (share/backend)
backend_dir = os.path.join(base_dir, "backend")

# Ensure backend directory is on Python path so that `backend.app` can be imported
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Also ensure base_dir (share) is on path for any top-level modules/services
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    try:
        logger.info("Starting server on port 8000...")
        # Change to backend directory for proper module resolution
        os.chdir(backend_dir)
        uvicorn.run(
            "app:app",
            host="0.0.0.0",
            port=8000,
            reload=False,
            log_level="info"
        )
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

