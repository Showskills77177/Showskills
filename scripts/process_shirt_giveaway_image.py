#!/usr/bin/env python3
"""Blur sponsor/league marks on the Ronaldo shirt giveaway prize image."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'scripts/assets/shirt-giveaway-source.png'
OUT_ASSET = ROOT / 'src/assets/kickups-giveaway-jersey.png'
OUT_EMAIL = ROOT / 'public/email/ronaldo-shirt-giveaway-jersey.png'

# (x0, y0, x1, y1) as fractions of width/height — tuned for 804×1024 source.
BLUR_BOXES = [
    (0.00, 0.20, 0.20, 0.46, 14),  # left sleeve — DXC
    (0.78, 0.20, 1.00, 0.46, 14),  # right sleeve — Premier League patch
    (0.44, 0.54, 0.58, 0.66, 10),  # small PL mark on the number
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
    OUT_EMAIL.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT_ASSET, format='PNG', optimize=True)
    im.save(OUT_EMAIL, format='PNG', optimize=True)
    print(f'Wrote {OUT_ASSET} ({OUT_ASSET.stat().st_size} bytes)')
    print(f'Wrote {OUT_EMAIL} ({OUT_EMAIL.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
