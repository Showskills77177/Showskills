#!/usr/bin/env python3
"""
Gently blur FIFA and Adidas marks on the World Cup ball prize image.

Detects logo regions from the pristine source photo, then applies a light blur.
Re-run after replacing scripts/assets/world-cup-ball-source.png.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'scripts/assets/world-cup-ball-source.png'
OUT_ASSET = ROOT / 'src/assets/world-cup-ball-prize.png'
DEBUG_MASK = ROOT / 'scripts/assets/world-cup-ball-blur-mask-debug.png'

# Measured on 1024×1024 source — trophy + FIFA wordmark; three stripes (left)
MANUAL_REGIONS = [
    (0.468, 0.430, 0.548, 0.632, 8, 5),  # trophy + "FIFA" wordmark (lower crest)
    (0.168, 0.485, 0.295, 0.645, 6, 4),  # Adidas three stripes (lower on red panel)
]


def box_from_fractions(w: int, h: int, x0: float, y0: float, x1: float, y1: float) -> tuple[int, int, int, int]:
    return (int(w * x0), int(h * y0), int(w * x1), int(h * y1))


def blur_region_soft(
    im: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    feather: int,
) -> None:
    x0, y0, x1, y1 = box
    crop = im.crop(box)
    blurred = crop.filter(ImageFilter.GaussianBlur(radius=radius))
    mw, mh = x1 - x0, y1 - y0
    mask = Image.new('L', (mw, mh), 0)
    draw = ImageDraw.Draw(mask)
    inset = max(1, feather // 2)
    draw.rounded_rectangle([inset, inset, mw - inset - 1, mh - inset - 1], radius=feather, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=max(1, feather // 2)))
    im.paste(blurred, (x0, y0), mask)


def build_debug_overlay(im: Image.Image, regions: list[tuple[float, float, float, float, int, int]]) -> Image.Image:
    w, h = im.size
    overlay = im.copy()
    draw = ImageDraw.Draw(overlay)
    for idx, (x0, y0, x1, y1, _radius, _feather) in enumerate(regions):
        box = box_from_fractions(w, h, x0, y0, x1, y1)
        color = (255, 60, 60) if idx == 0 else (60, 255, 100)
        draw.rectangle(box, outline=color, width=3)
    return overlay


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f'Missing pristine source: {SRC}')

    source = Image.open(SRC).convert('RGB')
    regions = MANUAL_REGIONS
    print(f'FIFA box:  {regions[0][:4]}')
    print(f'Adidas box: {regions[1][:4]}')

    im = source.copy()
    w, h = im.size
    for x0, y0, x1, y1, radius, feather in regions:
        blur_region_soft(im, box_from_fractions(w, h, x0, y0, x1, y1), radius, feather)

    OUT_ASSET.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT_ASSET, format='PNG', optimize=True)
    build_debug_overlay(source, regions).save(DEBUG_MASK)
    print(f'Wrote {OUT_ASSET} ({OUT_ASSET.stat().st_size} bytes)')
    print(f'Debug overlay: {DEBUG_MASK}')


if __name__ == '__main__':
    main()
