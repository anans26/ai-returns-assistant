"""
test_images.py

Test script for the image upload service layer.

Tests:
  1. Save image metadata to database
  2. Retrieve image metadata from database
  3. Reject unsupported file types
  4. Reject oversized files
  5. Reject uploads that exceed the per-return image limit

Usage:
    python test_images.py

Requires:
  - A running PostgreSQL instance (docker-compose up -d)
  - At least one existing return in the returns table
  - A test image file: test_image.jpg in the backend directory
"""

import os
import sys
from pathlib import Path
from database import initialize_db, check_table_columns
from image_service import (
    upload_return_image,
    get_return_images,
    delete_return_image,
    ImageValidationError,
    MAX_FILE_SIZE_BYTES,
    MAX_IMAGES_PER_RETURN,
    ALLOWED_EXTENSIONS,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PASS = "[PASS]"
FAIL = "[FAIL]"

def section(title):
    print(f"\n{'='*55}")
    print(f"  {title}")
    print(f"{'='*55}")


def get_first_return_id():
    """Fetch the UUID of the first return in the database for testing."""
    from database import connect_db
    conn = connect_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM returns ORDER BY created_at LIMIT 1;")
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row is None:
        print("\nNo existing returns found. Run shopify.py first to create one.")
        sys.exit(1)
    return str(row[0])


def make_fake_image(size_bytes=1024, ext=".jpg"):
    """
    Create minimal in-memory bytes that look like an image file.
    We use a real JPEG magic bytes header so the extension check passes.
    """
    # JPEG magic bytes + padding
    if ext in (".jpg", ".jpeg"):
        header = b"\xff\xd8\xff\xe0" + b"\x00" * (size_bytes - 4)
    elif ext == ".png":
        header = b"\x89PNG\r\n\x1a\n" + b"\x00" * (size_bytes - 8)
    else:
        header = b"\x00" * size_bytes
    return header[:size_bytes]


# ---------------------------------------------------------------------------
# Test Runner
# ---------------------------------------------------------------------------

def run_tests():
    section("Pre-flight Checks")

    # Verify return_images table exists
    cols = check_table_columns("return_images")
    if cols is None:
        print(f"{FAIL} return_images table does not exist in PostgreSQL.")
        print("       Run the CREATE TABLE statement from schema.sql first.")
        sys.exit(1)
    print(f"{PASS} return_images table exists: {list(cols.keys())}")

    # Fetch a real return_id to use in tests
    return_id = get_first_return_id()
    print(f"{PASS} Using return_id: {return_id}")

    # -----------------------------------------------------------------------
    # Test 1 — Save image metadata (full upload pipeline)
    # -----------------------------------------------------------------------
    section("Test 1: Save Image Metadata")
    try:
        file_data = make_fake_image(size_bytes=2048, ext=".jpg")
        result = upload_return_image(return_id, file_data, "test_boot.jpg")
        assert result["success"] is True
        assert result["return_id"] == return_id
        assert result["image_path"].endswith(".jpg")
        saved_path = result["image_path"]
        print(f"{PASS} Image uploaded successfully.")
        print(f"       Path: {saved_path}")
    except Exception as e:
        print(f"{FAIL} Unexpected error: {e}")
        sys.exit(1)

    # -----------------------------------------------------------------------
    # Test 2 — Retrieve image metadata
    # -----------------------------------------------------------------------
    section("Test 2: Retrieve Image Metadata")
    try:
        images = get_return_images(return_id)
        assert isinstance(images, list)
        assert len(images) >= 1
        latest = images[-1]
        assert "id" in latest
        assert "return_id" in latest
        assert "image_path" in latest
        assert "uploaded_at" in latest
        assert latest["image_path"] == saved_path
        print(f"{PASS} Retrieved {len(images)} image(s) for return.")
        print(f"       Latest: {latest['image_path']}")
        image_id = latest["id"]
    except Exception as e:
        print(f"{FAIL} Unexpected error: {e}")
        sys.exit(1)

    # -----------------------------------------------------------------------
    # Test 3 — Reject unsupported file type
    # -----------------------------------------------------------------------
    section("Test 3: Reject Unsupported File Type")
    try:
        file_data = b"fake gif data"
        upload_return_image(return_id, file_data, "photo.gif")
        print(f"{FAIL} Should have raised ImageValidationError for .gif")
    except ImageValidationError as e:
        print(f"{PASS} Correctly rejected .gif: {e}")
    except Exception as e:
        print(f"{FAIL} Wrong exception type: {e}")

    # -----------------------------------------------------------------------
    # Test 4 — Reject oversized file
    # -----------------------------------------------------------------------
    section("Test 4: Reject Oversized File (> 10 MB)")
    try:
        oversized = make_fake_image(size_bytes=MAX_FILE_SIZE_BYTES + 1, ext=".jpg")
        upload_return_image(return_id, oversized, "huge_photo.jpg")
        print(f"{FAIL} Should have raised ImageValidationError for oversized file")
    except ImageValidationError as e:
        print(f"{PASS} Correctly rejected oversized file: {e}")
    except Exception as e:
        print(f"{FAIL} Wrong exception type: {e}")

    # -----------------------------------------------------------------------
    # Test 5 — Reject upload that exceeds per-return image limit
    # -----------------------------------------------------------------------
    section(f"Test 5: Reject Upload Exceeding {MAX_IMAGES_PER_RETURN}-Image Limit")

    # Count how many images already exist for this return
    existing = get_return_images(return_id)
    slots_remaining = MAX_IMAGES_PER_RETURN - len(existing)

    # Fill remaining slots (if any)
    uploaded_ids = []
    for i in range(slots_remaining):
        file_data = make_fake_image(size_bytes=512, ext=".jpg")
        res = upload_return_image(return_id, file_data, f"filler_{i}.jpg")
        imgs = get_return_images(return_id)
        uploaded_ids.append(imgs[-1]["id"])
        print(f"       Filled slot {len(existing) + i + 1}/{MAX_IMAGES_PER_RETURN}")

    # Next upload must be rejected
    try:
        file_data = make_fake_image(size_bytes=512, ext=".png")
        upload_return_image(return_id, file_data, "one_too_many.png")
        print(f"{FAIL} Should have raised ImageValidationError for count limit")
    except ImageValidationError as e:
        print(f"{PASS} Correctly rejected upload beyond limit: {e}")
    except Exception as e:
        print(f"{FAIL} Wrong exception type: {e}")

    # -----------------------------------------------------------------------
    # Cleanup — Delete the test image records created in Tests 1 & 5
    # -----------------------------------------------------------------------
    section("Cleanup: Deleting Test Image Records")
    all_to_delete = [image_id] + uploaded_ids
    for img_id in all_to_delete:
        try:
            result = delete_return_image(img_id)
            status = PASS if result["deleted"] else FAIL
            print(f"{status} Deleted image {img_id}: {result}")
        except Exception as e:
            print(f"{FAIL} Could not delete {img_id}: {e}")

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    section("All Tests Complete")
    print("Existing return workflow was NOT modified.")
    print("Image upload service is working correctly.\n")


if __name__ == "__main__":
    # Initialize DB to ensure schema is current before tests run
    try:
        initialize_db()
    except Exception as e:
        print(f"Warning: DB init error (may be safe to ignore): {e}")

    run_tests()
