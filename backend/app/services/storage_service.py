"""
StorageService — centralized file upload/delete abstraction.

All Cloudinary configuration and upload logic lives here.
Routers simply call StorageService.upload_file() or StorageService.delete_file()
without knowing if the backend is Cloudinary or local disk.
"""
import os
import uuid
import logging
import shutil

logger = logging.getLogger(__name__)

# ── Cloudinary Configuration (initialized once at import time) ────────────────
_CLOUDINARY_CONFIGURED = False
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")

if CLOUDINARY_CLOUD_NAME:
    import cloudinary
    import cloudinary.uploader

    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=os.getenv("CLOUDINARY_API_KEY", ""),
        api_secret=os.getenv("CLOUDINARY_API_SECRET", ""),
        secure=True,
    )
    _CLOUDINARY_CONFIGURED = True


class StorageService:
    """Unified file storage abstraction over Cloudinary / local disk."""

    @staticmethod
    def is_cloud_enabled() -> bool:
        return _CLOUDINARY_CONFIGURED

    @staticmethod
    def upload_file(file_obj, folder: str = "yahav_receipts", content_type: str = "") -> str:
        """
        Uploads a file and returns its public URL.

        Args:
            file_obj: File-like object (e.g. UploadFile.file or raw bytes IO).
            folder: Cloudinary folder name (ignored for local uploads).
            content_type: MIME type hint (used for local file extension).

        Returns:
            The publicly-accessible URL of the uploaded file.

        Raises:
            RuntimeError: If the upload fails.
        """
        ext = ".pdf" if content_type == "application/pdf" else ".jpg"
        file_id = str(uuid.uuid4())

        if not _CLOUDINARY_CONFIGURED:
            # ── Local fallback (dev mode) ──
            os.makedirs("uploads", exist_ok=True)
            file_name = f"{file_id}{ext}"
            file_path = f"uploads/{file_name}"
            try:
                if hasattr(file_obj, "read"):
                    data = file_obj.read()
                    with open(file_path, "wb") as f:
                        f.write(data)
                else:
                    with open(file_path, "wb") as f:
                        shutil.copyfileobj(file_obj, f)
            except Exception as e:
                logger.error(f"[StorageService] Local upload failed: {e}")
                raise RuntimeError(f"Local upload failed: {e}")

            return f"http://localhost:8000/uploads/{file_name}"

        # ── Cloudinary upload ──
        try:
            result = cloudinary.uploader.upload(
                file_obj,
                folder=folder,
                resource_type="auto",  # auto-detect image vs raw (pdf)
            )
            return result.get("secure_url")
        except Exception as e:
            logger.error(f"[StorageService] Cloudinary upload failed: {e}")
            raise RuntimeError(f"Cloudinary upload failed: {e}")

    @staticmethod
    def delete_file(url: str) -> bool:
        """
        Deletes a file from Cloudinary by its URL.
        Returns True on success, False on failure.
        No-op for local files.
        """
        if not _CLOUDINARY_CONFIGURED:
            return False

        if "cloudinary.com" not in url:
            return False

        try:
            # Extract public_id from Cloudinary URL
            # e.g. https://res.cloudinary.com/cloud/image/upload/v123/yahav_receipts/file.jpg
            parts = url.split("/upload/")
            if len(parts) != 2:
                return False

            path_parts = parts[1].split("/")
            # Strip version prefix (v1234567)
            if path_parts[0].startswith("v") and path_parts[0][1:].isdigit():
                path_parts = path_parts[1:]

            full_path = "/".join(path_parts)
            public_id = full_path.rsplit(".", 1)[0]

            cloudinary.uploader.destroy(public_id)
            logger.info(f"[StorageService] Deleted {public_id} from Cloudinary")
            return True

        except Exception as e:
            logger.error(f"[StorageService] Failed to delete {url}: {e}")
            return False
