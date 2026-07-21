import os
import time
import hmac
import hashlib
import base64
import uuid
import boto3
from botocore.client import Config
from app.core.config import settings

LOCAL_STORAGE_ROOT = "/app/storage_data"  # mounted as a persistent Docker volume


# ---------- Shared (backend-agnostic) ----------

def build_object_key(org_id: str, project_id: str, category: str, filename: str) -> str:
    """
    Namespacing convention: org/project/category/uuid_filename
    This keeps tenants' files logically separated even on local disk - mirrors
    your DB tenant isolation pattern. Same key format works for R2 or local.
    e.g. orgs/<org_id>/projects/<project_id>/drawings/<uuid>_A-101-RevB.pdf
    """
    safe_filename = filename.replace(" ", "_")
    unique_prefix = uuid.uuid4().hex[:8]
    return f"orgs/{org_id}/projects/{project_id}/{category}/{unique_prefix}_{safe_filename}"


def upload_file(file_bytes: bytes, object_key: str, content_type: str) -> str:
    if settings.STORAGE_BACKEND == "local":
        return _local_upload(file_bytes, object_key)
    return _r2_upload(file_bytes, object_key, content_type)


def get_signed_url(object_key: str, expires_in: int = 3600) -> str:
    if settings.STORAGE_BACKEND == "local":
        return _local_signed_url(object_key, expires_in)
    return _r2_signed_url(object_key, expires_in)


# ---------- Local disk backend ----------

def _local_upload(file_bytes: bytes, object_key: str) -> str:
    full_path = os.path.join(LOCAL_STORAGE_ROOT, object_key)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(file_bytes)
    return object_key


def _sign(object_key: str, expires_at: int) -> str:
    message = f"{object_key}:{expires_at}".encode()
    digest = hmac.new(settings.JWT_SECRET.encode(), message, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def verify_local_token(object_key: str, expires_at: int, token: str) -> bool:
    """Called by the /api/files endpoint to validate a signed URL before serving the file."""
    if time.time() > expires_at:
        return False
    expected = _sign(object_key, expires_at)
    return hmac.compare_digest(expected, token)


def _local_signed_url(object_key: str, expires_in: int) -> str:
    """
    No real object storage means no native presigned URLs - so we generate
    our own time-limited HMAC-signed link pointing at a backend endpoint
    that streams the file. Same security property as R2's signed URLs:
    time-limited, can't be forged without the server's secret.
    """
    expires_at = int(time.time()) + expires_in
    token = _sign(object_key, expires_at)
    encoded_key = base64.urlsafe_b64encode(object_key.encode()).decode()
    return f"/api/files/{encoded_key}?expires={expires_at}&token={token}"


def local_file_path(object_key: str) -> str:
    return os.path.join(LOCAL_STORAGE_ROOT, object_key)


# ---------- Cloudflare R2 backend (for later) ----------

def get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def _r2_upload(file_bytes: bytes, object_key: str, content_type: str) -> str:
    client = get_r2_client()
    client.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=object_key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return object_key


def _r2_signed_url(object_key: str, expires_in: int) -> str:
    client = get_r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": object_key},
        ExpiresIn=expires_in,
    )
