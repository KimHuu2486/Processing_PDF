from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pypdf import PdfReader, PdfWriter

import pdf_tool
from pdf_tool import PdfToolError, extract_page_range, merge_pdfs, parse_page_range


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def create_pdf(path: Path, page_widths: list[int]) -> None:
    writer = PdfWriter()
    for width in page_widths:
        writer.add_blank_page(width=width, height=100)
    with path.open("wb") as output:
        writer.write(output)


def read_page_widths(path: Path) -> list[int]:
    return [int(page.mediabox.width) for page in PdfReader(path).pages]


class PdfToolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary_directory.name)

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_merge_preserves_file_and_page_order(self) -> None:
        first = self.directory / "first.pdf"
        second = self.directory / "second.pdf"
        output = self.directory / "merged.pdf"
        create_pdf(first, [100, 110])
        create_pdf(second, [200])

        page_count = merge_pdfs([first, second], output)

        self.assertEqual(page_count, 3)
        self.assertEqual(read_page_widths(output), [100, 110, 200])

    def test_extract_page_range_is_one_based_and_inclusive(self) -> None:
        source = self.directory / "source.pdf"
        output = self.directory / "extracted.pdf"
        create_pdf(source, [100, 200, 300, 400])

        page_count = extract_page_range(source, output, start=2, end=3)

        self.assertEqual(page_count, 2)
        self.assertEqual(read_page_widths(output), [200, 300])

    def test_extract_rejects_page_beyond_document(self) -> None:
        source = self.directory / "source.pdf"
        output = self.directory / "extracted.pdf"
        create_pdf(source, [100, 200])

        with self.assertRaisesRegex(PdfToolError, "vượt quá tổng số trang"):
            extract_page_range(source, output, start=1, end=3)

        self.assertFalse(output.exists())

    def test_output_is_not_overwritten_without_force(self) -> None:
        first = self.directory / "first.pdf"
        second = self.directory / "second.pdf"
        output = self.directory / "merged.pdf"
        create_pdf(first, [100])
        create_pdf(second, [200])
        output.write_bytes(b"do not overwrite")

        with self.assertRaisesRegex(PdfToolError, "đã tồn tại"):
            merge_pdfs([first, second], output)

        self.assertEqual(output.read_bytes(), b"do not overwrite")

    def test_force_allows_overwrite(self) -> None:
        first = self.directory / "first.pdf"
        second = self.directory / "second.pdf"
        output = self.directory / "merged.pdf"
        create_pdf(first, [100])
        create_pdf(second, [200])
        output.write_bytes(b"old content")

        merge_pdfs([first, second], output, force=True)

        self.assertEqual(read_page_widths(output), [100, 200])

    def test_output_cannot_be_an_input(self) -> None:
        first = self.directory / "first.pdf"
        second = self.directory / "second.pdf"
        create_pdf(first, [100])
        create_pdf(second, [200])

        with self.assertRaisesRegex(PdfToolError, "trùng với file đầu vào"):
            merge_pdfs([first, second], first, force=True)

    def test_output_created_after_validation_is_not_overwritten(self) -> None:
        first = self.directory / "first.pdf"
        second = self.directory / "second.pdf"
        output = self.directory / "merged.pdf"
        create_pdf(first, [100])
        create_pdf(second, [200])
        original_open_reader = pdf_tool._open_reader

        def open_reader_after_race(path: Path) -> PdfReader:
            if not output.exists():
                output.write_bytes(b"created by another process")
            return original_open_reader(path)

        with (
            patch("pdf_tool._open_reader", side_effect=open_reader_after_race),
            self.assertRaisesRegex(PdfToolError, "đã tồn tại"),
        ):
            merge_pdfs([first, second], output)

        self.assertEqual(output.read_bytes(), b"created by another process")

    @unittest.skipUnless(os.name == "nt", "Kiểm tra riêng cho Windows")
    def test_windows_no_clobber_does_not_require_hard_links(self) -> None:
        first = self.directory / "first.pdf"
        second = self.directory / "second.pdf"
        output = self.directory / "merged.pdf"
        create_pdf(first, [100])
        create_pdf(second, [200])

        with patch("pdf_tool.os.link", side_effect=AssertionError("unexpected call")):
            merge_pdfs([first, second], output)

        self.assertEqual(read_page_widths(output), [100, 200])

    def test_lazy_corrupt_pdf_returns_friendly_error(self) -> None:
        source = self.directory / "corrupt.pdf"
        output = self.directory / "extracted.pdf"
        create_pdf(source, [100])
        data = source.read_bytes()
        self.assertIn(b"/Pages 2 0 R", data)
        source.write_bytes(data.replace(b"/Pages 2 0 R", b"/Pxxxx 2 0 R", 1))

        with self.assertRaisesRegex(PdfToolError, "Không thể trích trang"):
            extract_page_range(source, output, start=1, end=1)

        self.assertFalse(output.exists())
        result = subprocess.run(
            [
                sys.executable,
                str(PROJECT_ROOT / "pdf_tool.py"),
                "split",
                str(source),
                "--pages",
                "1-1",
                "-o",
                str(output),
            ],
            cwd=PROJECT_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        stderr = result.stderr.decode("utf-8", errors="replace")
        self.assertEqual(result.returncode, 1)
        self.assertIn("Lỗi:", stderr)
        self.assertNotIn("Traceback", stderr)

    def test_encrypted_pdf_is_rejected(self) -> None:
        source = self.directory / "encrypted.pdf"
        output = self.directory / "extracted.pdf"
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.encrypt("secret")
        with source.open("wb") as encrypted_file:
            writer.write(encrypted_file)

        with self.assertRaisesRegex(PdfToolError, "mật khẩu"):
            extract_page_range(source, output, start=1, end=1)

        self.assertFalse(output.exists())

    def test_page_range_parser(self) -> None:
        self.assertEqual(parse_page_range(" 3 - 8 "), (3, 8))

    def test_help_works_when_windows_console_uses_cp1252(self) -> None:
        environment = os.environ.copy()
        environment["PYTHONIOENCODING"] = "cp1252"

        result = subprocess.run(
            [sys.executable, str(PROJECT_ROOT / "pdf_tool.py"), "--help"],
            cwd=PROJECT_ROOT,
            env=environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

        self.assertEqual(
            result.returncode,
            0,
            result.stderr.decode("utf-8", errors="replace"),
        )


if __name__ == "__main__":
    unittest.main()
