#!/usr/bin/env python3
import uvicorn
import sys
import os
import logging

# Current directory (where run_backend.py is located)
backend_dir = os.path.dirname(os.path.abspath(__file__))

# Add the backend directory to Python path
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Add the share directory to Python path for services
share_dir = os.path.dirname(__file__)
if share_dir not in sys.path:
    sys.path.insert(0, share_dir)

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

