"""
Stored profile pictures: what is accepted, what is written, what is cleaned up.

Everything an upload is trusted for is decided here, in one place, because the
interesting failures are all the same shape: a file that claims to be one thing
and is another. So nothing believes the extension or the browser's `Content-Type`
-- the bytes are decoded, and what the decoder says they are is what they are.

What lands on disk is never what was uploaded. Every image is re-encoded to one
square WebP under a random name, which drops EXIF (including the GPS tag on a
photo taken with a phone), removes any trailing payload smuggled after the image
data, and leaves a directory that can only ever contain images this module wrote.
"""

import logging
import re
import secrets
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from app.config import settings

log = logging.getLogger(__name__)

#: Formats accepted from the user. Not SVG: it is a document that can carry script,
#: and no amount of re-encoding makes serving one to a browser safe.
ALLOWED_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})

#: File signatures for the same three, checked before the decoder is handed
#: anything. `????` in the WebP header is the little-endian file size.
_MAGIC = (
    b"\xff\xd8\xff",  # JPEG
    b"\x89PNG\r\n\x1a\n",  # PNG
)

#: What this module writes, and therefore the only thing it will serve or delete.
STORED_NAME = re.compile(r"^[0-9a-f]{32}\.webp$")


class AvatarError(ValueError):
    """Rejected upload. The message is shown to the user, so it says what to do."""


def avatar_dir() -> Path:
    path = Path(settings.media_root) / "avatars"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _looks_like_image(data: bytes) -> bool:
    if data.startswith(_MAGIC):
        return True
    # RIFF....WEBP
    return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"


def store(data: bytes) -> str:
    """
    Validate, normalise and write one avatar. Returns the stored filename.

    Raises `AvatarError` for anything that is not a still image this module is
    willing to serve back.
    """
    if not data:
        raise AvatarError("That file is empty.")
    if len(data) > settings.max_avatar_bytes:
        megabytes = settings.max_avatar_bytes / 1024 / 1024
        raise AvatarError(f"That image is larger than {megabytes:.0f} MB.")
    if not _looks_like_image(data):
        raise AvatarError("That file is not a JPEG, PNG or WebP image.")

    # Decoded twice on purpose: `verify()` is the only thing that detects a
    # truncated or corrupt file, and it leaves the image object unusable, so the
    # copy that gets resized is opened fresh afterwards.
    try:
        probe = Image.open(BytesIO(data))
        probe.verify()
    except UnidentifiedImageError as exc:
        raise AvatarError("That file is not an image the server can read.") from exc
    except Image.DecompressionBombError as exc:
        raise AvatarError("That image is too large to process.") from exc
    except Exception as exc:  # noqa: BLE001 -- a broken file is a rejection, not a 500
        raise AvatarError("That image is damaged or incomplete.") from exc

    if probe.format not in ALLOWED_FORMATS:
        raise AvatarError("Profile pictures must be JPEG, PNG or WebP.")

    try:
        image = Image.open(BytesIO(data))
        # An animated WebP or GIF-in-WebP would be re-encoded to its first frame
        # silently, which is not what the person uploading it asked for.
        if getattr(image, "n_frames", 1) > 1:
            raise AvatarError("Animated images are not supported -- upload a still picture.")
        image = _square(image)
    except AvatarError:
        raise
    except Image.DecompressionBombError as exc:
        raise AvatarError("That image is too large to process.") from exc
    except Exception as exc:  # noqa: BLE001
        raise AvatarError("That image is damaged or incomplete.") from exc

    filename = f"{secrets.token_hex(16)}.webp"
    target = avatar_dir() / filename
    # Written beside the target and moved into place, so a failure halfway through
    # cannot leave a half-written avatar being served to everyone.
    staging = target.with_suffix(".part")
    try:
        # No `exif=`, no `icc_profile=`: what is not passed is not written, which
        # is how the metadata comes off.
        image.save(staging, format="WEBP", quality=88, method=4)
        staging.replace(target)
    finally:
        staging.unlink(missing_ok=True)
    return filename


def _square(image: Image.Image) -> Image.Image:
    """Centre-crop to a square and resize. The client crops too; this is the floor."""
    if image.mode in ("RGBA", "LA", "P"):
        # WebP carries alpha, so a PNG cut-out stays a cut-out rather than gaining
        # a black box behind it.
        image = image.convert("RGBA")
    else:
        image = image.convert("RGB")

    width, height = image.size
    if width == 0 or height == 0:
        raise AvatarError("That image has no pixels.")

    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    image = image.crop((left, top, left + side, top + side))

    size = settings.avatar_pixels
    if image.size != (size, size):
        image = image.resize((size, size), Image.LANCZOS)
    return image


def path_for(filename: str) -> Path | None:
    """The file behind a stored name, or None if the name is not one of ours."""
    if not filename or not STORED_NAME.match(filename):
        return None
    candidate = (avatar_dir() / filename).resolve()
    # Belt and braces: the pattern above already forbids a separator or a dot
    # segment, so this can only fail if the directory itself is a symlink out.
    if candidate.parent != avatar_dir().resolve():
        return None
    return candidate if candidate.is_file() else None


def discard(filename: str | None) -> None:
    """
    Remove a replaced or deleted avatar.

    Never raises: the database row is the record of what a user has, and failing
    to unlink a stale file must not fail the request that replaced it.
    """
    if not filename or not STORED_NAME.match(filename):
        return
    try:
        (avatar_dir() / filename).unlink(missing_ok=True)
    except OSError as exc:  # pragma: no cover -- permissions, read-only volume
        log.warning("could not remove old avatar %s: %s", filename, exc)
