"""
Google Cloud Storage utilities for the Intelligence platform.

Single bucket (from GCS_BUCKET config), tools use path prefixes for separation.
The client is lazy-initialized from service account credentials.

Usage:

    from shared.backend.storage.gcs import upload_file, download_file, get_signed_url, delete_file

    upload_file("skeleton/test.txt", b"hello", content_type="text/plain")
    data = download_file("skeleton/test.txt")
    url = get_signed_url("skeleton/test.txt", expiration_minutes=30)
    delete_file("skeleton/test.txt")
"""

import datetime

from google.cloud import storage

from shared.backend.config import settings

_client = None


def _get_client():
    """Return the shared GCS client, creating it on first call."""
    global _client
    if _client is None:
        _client = storage.Client.from_service_account_json(
            settings.gcs_credentials_path, project=settings.gcs_project
        )
    return _client


def get_bucket():
    """Get the configured GCS bucket."""
    return _get_client().bucket(settings.gcs_bucket)


def upload_file(blob_path: str, data: bytes, content_type: str = "application/octet-stream"):
    """Upload bytes to GCS. Returns the blob's public URL."""
    blob = get_bucket().blob(blob_path)
    blob.upload_from_string(data, content_type=content_type)
    return blob.public_url


def download_file(blob_path: str) -> bytes:
    """Download a blob from GCS and return its contents as bytes."""
    blob = get_bucket().blob(blob_path)
    return blob.download_as_bytes()


def get_signed_url(blob_path: str, expiration_minutes: int = 60) -> str:
    """Generate a time-limited signed URL for frontend access to a private blob."""
    blob = get_bucket().blob(blob_path)
    return blob.generate_signed_url(
        expiration=datetime.timedelta(minutes=expiration_minutes),
        method="GET",
    )


def delete_file(blob_path: str):
    """Delete a blob from GCS."""
    blob = get_bucket().blob(blob_path)
    blob.delete()
