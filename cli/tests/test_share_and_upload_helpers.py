from pathlib import Path

from cli.main import _is_upload_text_file


def test_upload_text_file_detection() -> None:
    assert _is_upload_text_file(Path("notes.md"))
    assert _is_upload_text_file(Path("script.py"))
    assert not _is_upload_text_file(Path("diagram.png"))
