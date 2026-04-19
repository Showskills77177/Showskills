#!/usr/bin/env python3
"""
Remove the grey plate via edge flood-fill, then output an all-white logo on transparency
(badger cut-outs stay solid white). Trims to alpha bbox.
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src/assets/showskills-logo-header-light.png"
OUT = ROOT / "src/assets/showskills-logo-header.png"

# Max RGB distance from corner colour to count as "plate" for flood (connectivity)
PLATE_DIST = 42


def main() -> None:
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    px = im.load()

    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    br = sum(c[0] for c in corners) // 4
    bgc = sum(c[1] for c in corners) // 4
    bb = sum(c[2] for c in corners) // 4

    def plate_like(r: int, g: int, b: int) -> bool:
        d = ((r - br) ** 2 + (g - bgc) ** 2 + (b - bb) ** 2) ** 0.5
        return d < PLATE_DIST

    bg = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h and not bg[y][x]:
            r, g, b = px[x, y]
            if plate_like(r, g, b):
                bg[y][x] = True
                q.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx]:
                r, g, b = px[nx, ny]
                if plate_like(r, g, b):
                    bg[ny][nx] = True
                    q.append((nx, ny))

    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            if bg[y][x]:
                op[x, y] = (255, 255, 255, 0)
            else:
                op[x, y] = (255, 255, 255, 255)

    bb_alpha = out.getchannel("A").getbbox()
    if bb_alpha:
        pad = 2
        out = out.crop(
            (
                max(0, bb_alpha[0] - pad),
                max(0, bb_alpha[1] - pad),
                min(w, bb_alpha[2] + pad),
                min(h, bb_alpha[3] + pad),
            )
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, optimize=True)
    print(f"Wrote {OUT} size={out.size}")


if __name__ == "__main__":
    main()
