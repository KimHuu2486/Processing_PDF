"""Công cụ dòng lệnh để gộp và trích khoảng trang từ file PDF."""

from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Iterable, Sequence

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError


class PdfToolError(Exception):
    """Lỗi có thể hiển thị trực tiếp cho người dùng CLI."""


def _configure_console_encoding() -> None:
    """Bảo đảm thông báo tiếng Việt hoạt động trên Windows console cũ."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="replace")


def parse_page_range(value: str) -> tuple[int, int]:
    """Chuyển chuỗi START-END thành hai số trang bắt đầu từ 1."""
    match = re.fullmatch(r"\s*(\d+)\s*-\s*(\d+)\s*", value)
    if not match:
        raise argparse.ArgumentTypeError(
            "Khoảng trang phải có dạng START-END, ví dụ: 3-8."
        )

    start, end = (int(part) for part in match.groups())
    if start < 1:
        raise argparse.ArgumentTypeError("Số trang bắt đầu phải lớn hơn hoặc bằng 1.")
    if start > end:
        raise argparse.ArgumentTypeError(
            "Trang bắt đầu không được lớn hơn trang kết thúc."
        )
    return start, end


def _resolve_input(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if not resolved.exists():
        raise PdfToolError(f"Không tìm thấy file đầu vào: {path}")
    if not resolved.is_file():
        raise PdfToolError(f"Đầu vào không phải là file: {path}")
    if resolved.suffix.lower() != ".pdf":
        raise PdfToolError(f"File đầu vào phải có phần mở rộng .pdf: {path}")
    return resolved


def _resolve_output(path: Path, inputs: Iterable[Path], force: bool) -> Path:
    resolved = path.expanduser().resolve()
    input_paths = {input_path.resolve() for input_path in inputs}

    if resolved in input_paths:
        raise PdfToolError("File đầu ra không được trùng với file đầu vào.")
    if not resolved.parent.exists():
        raise PdfToolError(f"Thư mục đầu ra không tồn tại: {resolved.parent}")
    if not resolved.parent.is_dir():
        raise PdfToolError(f"Đường dẫn đầu ra không nằm trong một thư mục hợp lệ.")
    if resolved.exists() and resolved.is_dir():
        raise PdfToolError(f"Đường dẫn đầu ra đang là một thư mục: {path}")
    if resolved.exists() and not force:
        raise PdfToolError(
            f"File đầu ra đã tồn tại: {path}. Dùng --force nếu muốn ghi đè."
        )
    return resolved


def _open_reader(path: Path) -> PdfReader:
    try:
        reader = PdfReader(path, strict=False)
    except (OSError, PdfReadError, ValueError) as exc:
        raise PdfToolError(f"Không thể đọc file PDF '{path}': {exc}") from exc

    if reader.is_encrypted:
        raise PdfToolError(f"PDF có mật khẩu chưa được hỗ trợ: {path}")
    return reader


def _write_atomically(writer: PdfWriter, output: Path, force: bool) -> None:
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            prefix=f".{output.stem}-",
            suffix=".tmp",
            dir=output.parent,
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            writer.write(temporary_file)

        if force:
            os.replace(temporary_path, output)
        else:
            try:
                if os.name == "nt":
                    os.rename(temporary_path, output)
                else:
                    os.link(temporary_path, output)
            except FileExistsError as exc:
                raise PdfToolError(
                    f"File đầu ra đã tồn tại: {output}. "
                    "Dùng --force nếu muốn ghi đè."
                ) from exc
    except PdfToolError:
        raise
    except OSError as exc:
        raise PdfToolError(f"Không thể ghi file đầu ra '{output}': {exc}") from exc
    finally:
        if temporary_path is not None and temporary_path.exists():
            try:
                temporary_path.unlink()
            except OSError:
                pass


def merge_pdfs(inputs: Sequence[Path], output: Path, force: bool = False) -> int:
    """Gộp các PDF theo thứ tự đầu vào và trả về tổng số trang."""
    if len(inputs) < 2:
        raise PdfToolError("Cần ít nhất hai file PDF để gộp.")

    resolved_inputs = [_resolve_input(path) for path in inputs]
    resolved_output = _resolve_output(output, resolved_inputs, force)
    try:
        writer = PdfWriter()
        total_pages = 0
        for path in resolved_inputs:
            reader = _open_reader(path)
            try:
                for page in reader.pages:
                    writer.add_page(page)
                    total_pages += 1
            finally:
                reader.close()

        _write_atomically(writer, resolved_output, force)
        return total_pages
    except PdfToolError:
        raise
    except Exception as exc:
        raise PdfToolError(f"Không thể gộp các file PDF: {exc}") from exc


def extract_page_range(
    input_path: Path,
    output: Path,
    start: int,
    end: int,
    force: bool = False,
) -> int:
    """Trích một khoảng trang bao gồm cả trang đầu và trang cuối."""
    resolved_input = _resolve_input(input_path)
    resolved_output = _resolve_output(output, [resolved_input], force)
    try:
        reader = _open_reader(resolved_input)
        try:
            total_pages = len(reader.pages)

            if start < 1 or end < start:
                raise PdfToolError("Khoảng trang không hợp lệ.")
            if end > total_pages:
                raise PdfToolError(
                    f"Trang kết thúc ({end}) vượt quá tổng số trang ({total_pages})."
                )

            writer = PdfWriter()
            for page_index in range(start - 1, end):
                writer.add_page(reader.pages[page_index])

            _write_atomically(writer, resolved_output, force)
            return end - start + 1
        finally:
            reader.close()
    except PdfToolError:
        raise
    except Exception as exc:
        raise PdfToolError(f"Không thể trích trang từ PDF: {exc}") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pdf_tool.py",
        description="Gộp PDF hoặc trích một khoảng trang thành PDF mới.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    merge_parser = subparsers.add_parser("merge", help="Gộp nhiều file PDF.")
    merge_parser.add_argument("inputs", nargs="+", type=Path, help="Các PDF đầu vào.")
    merge_parser.add_argument(
        "-o", "--output", type=Path, required=True, help="File PDF đầu ra."
    )
    merge_parser.add_argument(
        "--force", action="store_true", help="Ghi đè file đầu ra nếu đã tồn tại."
    )

    split_parser = subparsers.add_parser(
        "split", help="Trích một khoảng trang từ PDF."
    )
    split_parser.add_argument("input", type=Path, help="File PDF đầu vào.")
    split_parser.add_argument(
        "--pages",
        type=parse_page_range,
        required=True,
        metavar="START-END",
        help="Khoảng trang cần lấy, tính từ 1 và bao gồm hai đầu.",
    )
    split_parser.add_argument(
        "-o", "--output", type=Path, required=True, help="File PDF đầu ra."
    )
    split_parser.add_argument(
        "--force", action="store_true", help="Ghi đè file đầu ra nếu đã tồn tại."
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    _configure_console_encoding()
    args = build_parser().parse_args(argv)
    try:
        if args.command == "merge":
            page_count = merge_pdfs(args.inputs, args.output, args.force)
            print(f"Đã gộp {len(args.inputs)} file, tổng cộng {page_count} trang.")
        else:
            start, end = args.pages
            page_count = extract_page_range(
                args.input, args.output, start, end, args.force
            )
            print(f"Đã trích {page_count} trang (từ trang {start} đến {end}).")
    except PdfToolError as exc:
        print(f"Lỗi: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
