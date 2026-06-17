"""
image_service.py

Service layer for return image uploads.

Responsibilities:
  - Validate uploaded files (type, size, count)
  - Manage the uploads/ directory structure
  - Persist image metadata to PostgreSQL via database.py
  - Expose clean functions ready for future FastAPI endpoint wiring

Upload directory layout:
    backend/uploads/<return_id>/<uuid>_<safe_filename>.<ext>

Future FastAPI usage:
    content = await file.read()
    result = upload_return_image(return_id, content, file.filename)
"""

import os
import uuid
import re
from pathlib import Path

from database import (
    save_return_image,
    get_return_images as db_get_return_images,
    delete_return_image as db_delete_return_image,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Absolute path to the uploads directory (sits next to this file)
UPLOADS_BASE_DIR = Path(__file__).parent / "uploads"

# Permitted image extensions (lowercase)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Maximum file size: 10 MB
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

# Maximum images stored per return request
MAX_IMAGES_PER_RETURN = 5


# ---------------------------------------------------------------------------
# Phase 2 — File Storage Helpers
# ---------------------------------------------------------------------------

def generate_safe_filename(original_filename):
    """
    Generate a unique, safe filename from the original name.

    - Strips path components so only the basename is used.
    - Replaces any character that is not alphanumeric, dash, underscore,
      or dot with an underscore to prevent directory traversal and shell
      injection.
    - Prepends a UUID4 to guarantee uniqueness and prevent collisions.
    - Preserves the original file extension (lowercased).

    Args:
        original_filename (str): The filename as supplied by the uploader.

    Returns:
        str: A safe, unique filename.  e.g. "3f2a1b..._damaged_boot.jpg"
    """
    # Take only the final component to strip any path prefix
    basename = Path(original_filename).name

    # Separate stem and extension
    stem = Path(basename).stem
    ext  = Path(basename).suffix.lower()

    # Sanitize stem: keep only safe characters
    safe_stem = re.sub(r"[^\w\-]", "_", stem)

    # Limit stem length to avoid filesystem issues
    safe_stem = safe_stem[:64]

    return f"{uuid.uuid4().hex}_{safe_stem}{ext}"


def create_upload_folder(return_id):
    """
    Create the upload sub-directory for a specific return request.

    The directory is created at:
        uploads/<return_id>/

    Args:
        return_id: UUID of the return request (string or UUID object).

    Returns:
        pathlib.Path: Absolute path to the created (or existing) directory.
    """
    folder = UPLOADS_BASE_DIR / str(return_id)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def save_uploaded_file(return_id, file_data, original_filename):
    """
    Write file bytes to disk inside the return's upload directory.

    Args:
        return_id:         UUID of the return request.
        file_data (bytes): Raw bytes of the image file.
        original_filename (str): Original filename (used to derive extension).

    Returns:
        str: The relative file path stored in the database,
             e.g. "uploads/<return_id>/<safe_name>.jpg"
    """
    folder = create_upload_folder(return_id)
    safe_name = generate_safe_filename(original_filename)
    dest_path = folder / safe_name

    with open(dest_path, "wb") as f:
        f.write(file_data)

    # Return a portable relative path (forward slashes)
    relative = dest_path.relative_to(Path(__file__).parent)
    return str(relative).replace("\\", "/")


# ---------------------------------------------------------------------------
# Phase 3 — Validation
# ---------------------------------------------------------------------------

class ImageValidationError(Exception):
    """Raised when an uploaded image fails validation."""


def validate_image(original_filename, file_size_bytes, return_id):
    """
    Validate an image before it is saved.

    Checks performed (in order):
        1. File extension is in ALLOWED_EXTENSIONS.
        2. File size does not exceed MAX_FILE_SIZE_BYTES.
        3. The return has not already reached MAX_IMAGES_PER_RETURN.

    Args:
        original_filename (str):  Original name of the uploaded file.
        file_size_bytes (int):    Size of the file in bytes.
        return_id:                UUID of the target return request.

    Raises:
        ImageValidationError: With a human-readable message describing
                              the specific rule that was violated.
    """
    ext = Path(original_filename).suffix.lower()

    # 1. Extension check
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise ImageValidationError(
            f"Unsupported file type '{ext}'. "
            f"Allowed types: {allowed}."
        )

    # 2. Size check
    if file_size_bytes > MAX_FILE_SIZE_BYTES:
        max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
        actual_mb = file_size_bytes / (1024 * 1024)
        raise ImageValidationError(
            f"File is too large ({actual_mb:.1f} MB). "
            f"Maximum allowed size is {max_mb} MB."
        )

    # 3. Count check
    existing = db_get_return_images(return_id)
    if len(existing) >= MAX_IMAGES_PER_RETURN:
        raise ImageValidationError(
            f"Return request already has {len(existing)} image(s). "
            f"Maximum allowed is {MAX_IMAGES_PER_RETURN}."
        )


# ---------------------------------------------------------------------------
# Phase 4 — Service Functions (API-Ready)
# ---------------------------------------------------------------------------

def upload_return_image(return_id, file_data, original_filename):
    """
    Full image upload pipeline.

    Flow:
        Validate file  →  Save to disk  →  Store path in PostgreSQL

    Args:
        return_id:         UUID of the return request (str or UUID).
        file_data (bytes): Raw bytes of the image.
        original_filename (str): Original filename from the uploader.

    Returns:
        dict: {
            "success": True,
            "image_path": "<relative path stored in DB>",
            "return_id": "<return_id as string>"
        }

    Raises:
        ImageValidationError: If the file fails any validation check.
        Exception:            If a disk write or database error occurs.

    Future FastAPI usage:
        content = await file.read()
        result  = upload_return_image(return_id, content, file.filename)
    """
    return_id = str(return_id)

    # Step 1: Validate
    validate_image(original_filename, len(file_data), return_id)

    # Step 2: Save to disk
    image_path = save_uploaded_file(return_id, file_data, original_filename)

    # Step 3: Persist path to PostgreSQL
    save_return_image(return_id, image_path)

    return {
        "success": True,
        "image_path": image_path,
        "return_id": return_id,
    }


def get_return_images(return_id):
    """
    Retrieve all image records for a return request.

    Args:
        return_id: UUID of the return request.

    Returns:
        List of dicts with keys: id, return_id, image_path, uploaded_at.

    Future FastAPI usage:
        images = get_return_images(return_id)
        return JSONResponse(content={"images": images})
    """
    return db_get_return_images(str(return_id))


def delete_return_image(image_id):
    """
    Delete an image record from PostgreSQL.

    Note: This does NOT delete the file from disk. The physical file
    is retained for audit purposes; only the DB record is removed.

    Args:
        image_id: UUID of the image row.

    Returns:
        dict: {
            "success": True/False,
            "deleted": True if a row was removed, False if not found.
        }

    Raises:
        Exception: Re-raises database errors.

    Future FastAPI usage:
        result = delete_return_image(image_id)
        return JSONResponse(content=result)
    """
    deleted = db_delete_return_image(str(image_id))
    return {
        "success": True,
        "deleted": deleted,
    }
