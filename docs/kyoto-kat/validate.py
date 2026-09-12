#!/usr/bin/env python3
"""Validate and index the Kyoto Kat reference package (standard library only)."""
import argparse
import hashlib
import json
import struct
from pathlib import Path

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("package", type=Path)
    args = parser.parse_args()
    root = args.package
    manifest = json.loads((root / "manifest.json").read_text())
    items = manifest["items"]
    assert len(items) == 50, "Expected 50 items"
    assert {x["id"] for x in items} == {f"kk-{i:03}" for i in range(1, 51)}
    seen: set[str] = set()
    for item in items:
        path = root / item["reference"]
        data = path.read_bytes()
        assert data[:8] == b"\x89PNG\r\n\x1a\n", path
        width, height = struct.unpack(">II", data[16:24])
        assert min(width, height) >= 1024, (path, width, height)
        digest = hashlib.sha256(data).hexdigest()
        assert digest not in seen, f"Duplicate image: {path}"
        seen.add(digest)
        assert digest == item["sha256"], f"Checksum mismatch: {path}"
        assert item["qa"] == "reviewed", f"Review pending: {path}"
    print("PASS: 50 unique PNGs, >=1024px, all manifest paths and SHA-256 checksums verified.")

if __name__ == "__main__":
    main()

