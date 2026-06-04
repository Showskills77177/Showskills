#!/usr/bin/env python3
"""Blur the Apple logo on the Legacy Bundle gold case prize photo."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'scripts/assets/gold-case-source.png'
OUT_ASSET = ROOT / 'src/assets/iphone-17-pro-max-gold-case.png'

# (x0, y0, x1, y1, radius) — centered Apple mark on the case back.
BLUR_BOXES = [
    (0.42, 0.38, 0.58, 0.52, 12),
]


def box_from_fractions(w: int, h: int, x0: float, y0: float, x1: float, y1: float) -> tuple[int, int, int, int]:
    return (int(w * x0), int(h * y0), int(w * x1), int(h * y1))


def blur_region(im: Image.Image, box: tuple[int, int, int, int], radius: int) -> None:
    crop = im.crop(box)
    im.paste(crop.filter(ImageFilter.GaussianBlur(radius=radius)), box)


def main() -> None:
    im = Image.open(SRC).convert('RGB')
    w, h = im.size
    for x0, y0, x1, y1, radius in BLUR_BOXES:
        blur_region(im, box_from_fractions(w, h, x0, y0, x1, y1), radius)

    OUT_ASSET.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT_ASSET, format='PNG', optimize=True)
    print(f'Wrote {OUT_ASSET} ({OUT_ASSET.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
