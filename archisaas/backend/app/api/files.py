import base64
import os
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from app.services.storage import verify_local_token, local_file_path

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/{encoded_key}")
async def serve_local_file(encoded_key: str, expires: int = Query(...), token: str = Query(...)):
    """
    Only reachable with a valid, non-expired signature - generated exclusively
    by get_signed_url() in storage.py. There is no way to browse or guess
    other files: without the server's JWT_SECRET, a forged token fails the
    HMAC check. This is the local-disk equivalent of R2's presigned URLs.
    """
    try:
        object_key = base64.urlsafe_b64decode(encoded_key.encode()).decode()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file reference")

    if not verify_local_token(object_key, expires, token):
        raise HTTPException(status_code=403, detail="Link expired or invalid")

    full_path = local_file_path(object_key)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(full_path)
