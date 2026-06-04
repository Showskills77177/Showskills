#!/usr/bin/env python3
"""
Blur sponsor marks on the Ronaldo shirt giveaway image.

Blurs sleeve badges and the full white diagonal stem of the 7 (signature + PL lion).
The horizontal top bar of the 7 and red fabric stay sharp.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'scripts/assets/shirt-giveaway-source.png'
OUT_ASSET = ROOT / 'src/assets/kickups-giveaway-jersey.png'
OUT_EMAIL = ROOT / 'public/email/ronaldo-shirt-giveaway-jersey.png'
DEBUG_MASK = ROOT / 'scripts/assets/shirt-giveaway-blur-mask-debug.png'

BLUR_BOXES = [
    (0.02, 0.26, 0.16, 0.40, 5),
    (0.82, 0.26, 0.98, 0.40, 5),
]

STEM_ROI = (0.40, 0.47, 0.56, 0.62)
# Rows above this are the horizontal bar of the 7, not the diagonal stem.
STEM_MIN_Y = 0.468
STEM_ROW_MIN_WHITE = 8
STEM_EDGE_MARGIN_PX = 5


def box_from_fractions(w: int, h: int, x0: float, y0: float, x1: float, y1: float) -> tuple[int, int, int, int]:
    return (int(w * x0), int(h * y0), int(w * x1), int(h * y1))


def blur_region(im: Image.Image, box: tuple[int, int, int, int], radius: int) -> None:
    crop = im.crop(box)
    im.paste(crop.filter(ImageFilter.GaussianBlur(radius=radius)), box)


def _is_white_stem(r: int, g: int, b: int) -> bool:
    lum = (r + g + b) / 3
    chroma = max(r, g, b) - min(r, g, b)
    return lum > 185 and chroma < 35


def _is_signature_ink(r: int, g: int, b: int) -> bool:
    lum = (r + g + b) / 3
    chroma = max(r, g, b) - min(r, g, b)
    return lum < 75 and chroma < 45


def build_diagonal_stem_mask(im: Image.Image) -> Image.Image:
    """Mask the full white diagonal stem by tracing its left/right edges per row."""
    w, h = im.size
    px = im.load()
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)

    rx0, ry0, rx1, ry1 = STEM_ROI
    x_min = int(w * rx0)
    x_max = int(w * rx1)
    y_min = int(h * ry0)
    y_max = int(h * ry1)
    margin = STEM_EDGE_MARGIN_PX

    for y in range(y_min, y_max):
        if y / h < STEM_MIN_Y:
            continue
        white_xs = [
            x for x in range(x_min, x_max) if _is_white_stem(*px[x, y])
        ]
        if len(white_xs) < STEM_ROW_MIN_WHITE:
            continue
        left = max(0, min(white_xs) - margin)
        right = min(w - 1, max(white_xs) + margin)
        draw.rectangle([left, y, right, y], fill=255)

    for y in range(y_min, y_max):
        if y / h < STEM_MIN_Y:
            continue
        for x in range(x_min, x_max):
            if _is_signature_ink(*px[x, y]):
                draw.point((x, y), fill=255)

    return mask.filter(ImageFilter.GaussianBlur(radius=1))


def apply_masked_blur(im: Image.Image, mask: Image.Image, radius: int) -> None:
    blurred = im.filter(ImageFilter.GaussianBlur(radius=radius))
    im.paste(blurred, (0, 0), mask)


def main() -> None:
    im = Image.open(SRC).convert('RGB')
    w, h = im.size

    for x0, y0, x1, y1, radius in BLUR_BOXES:
        blur_region(im, box_from_fractions(w, h, x0, y0, x1, y1), radius)

    mask = build_diagonal_stem_mask(im)
    apply_masked_blur(im, mask, radius=14)

    OUT_ASSET.parent.mkdir(parents=True, exist_ok=True)
    OUT_EMAIL.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT_ASSET, format='PNG', optimize=True)
    im.save(OUT_EMAIL, format='PNG', optimize=True)
    mask.save(DEBUG_MASK)
    print(f'Wrote {OUT_ASSET} ({OUT_ASSET.stat().st_size} bytes)')
    print(f'Wrote {OUT_EMAIL} ({OUT_EMAIL.stat().st_size} bytes)')
    print(f'Debug mask: {DEBUG_MASK}')


if __name__ == '__main__':
    main()
