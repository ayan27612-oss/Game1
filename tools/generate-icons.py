#!/usr/bin/env python3
"""Render the WARFORGE PWA icon set from the same geometry as assets/icon.svg.

Requires Pillow and NumPy (development-time only; the game itself has no
runtime dependencies). Run from the repository root:

    python3 tools/generate-icons.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"
MASTER = 1024


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def background(size: int) -> Image.Image:
    """Dark Stark hangar gradient with a warm reactor halo."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    u = (xx / (size - 1) + yy / (size - 1)) * 0.5
    v = yy / (size - 1)

    top = np.array([5, 7, 13], dtype=np.float32)
    mid = np.array([11, 16, 25], dtype=np.float32)
    bottom = np.array([36, 16, 10], dtype=np.float32)

    img = np.empty((size, size, 3), dtype=np.float32)
    for c in range(3):
        img[..., c] = np.where(
            v < 0.55,
            lerp(top[c], mid[c], v / 0.55),
            lerp(mid[c], bottom[c], (v - 0.55) / 0.45),
        )
    img *= (0.9 + u[..., None] * 0.14)

    cx = cy = size * 0.5
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy * 0.9) ** 2) / (size * 0.62)
    glow = np.clip(1.0 - dist, 0.0, 1.0) ** 2
    for c, amount in enumerate((255, 179, 71)):
        img[..., c] += glow * amount * 0.15
    for c, amount in enumerate((181, 18, 27)):
        img[..., c] += glow * amount * 0.10

    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def draw_art(size: int, scale: float = 1.0) -> Image.Image:
    """Draw the Iron Man helmet sigil on a transparent canvas."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s = size / 512.0

    def x(v: float) -> float:
        return (256.0 + (v - 256.0) * scale) * s

    def y(v: float) -> float:
        return (256.0 + (v - 256.0) * scale) * s

    def pts(values: list[tuple[float, float]]) -> list[tuple[float, float]]:
        return [(x(px), y(py)) for px, py in values]

    def w(units: float) -> int:
        return max(1, int(units * s * max(scale, 0.18)))

    # --- faint hangar grid ------------------------------------------------
    grid = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for i in range(1, 8):
        q = i * 64 * s
        gd.line([(0, q), (size, q)], fill=(143, 232, 255, 14), width=max(1, int(s)))
        gd.line([(q, 0), (q, size)], fill=(143, 232, 255, 14), width=max(1, int(s)))
    canvas.alpha_composite(grid)

    # --- gold reactor ring ------------------------------------------------
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    cx, cy = x(256), y(252)
    ring_r = 196 * scale * s
    for i in range(12):
        start = -18 + i * 30
        rd.arc(
            [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
            start=start,
            end=start + 21,
            fill=(255, 179, 71, 220),
            width=w(3),
        )
    inner_r = 170 * scale * s
    rd.ellipse(
        [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
        outline=(255, 75, 58, 90),
        width=w(2),
    )
    canvas.alpha_composite(ring.filter(ImageFilter.GaussianBlur(radius=9 * s)))
    canvas.alpha_composite(ring)

    # --- red helmet shell -------------------------------------------------
    shell = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shell)
    helmet = [
        (256, 70), (318, 80), (350, 108), (370, 150), (370, 282), (356, 340),
        (330, 388), (294, 418), (256, 440), (218, 418), (182, 388), (156, 340),
        (142, 282), (142, 150), (162, 108), (194, 80),
    ]
    sd.polygon(pts(helmet), fill=(200, 29, 37, 255))
    # Lighter crown highlight.
    sd.polygon(
        pts([(256, 70), (318, 80), (350, 108), (370, 150), (340, 170), (300, 130), (256, 116), (212, 130), (172, 170), (142, 150), (162, 108), (194, 80)]),
        fill=(255, 106, 77, 55),
    )
    sd.line(pts(helmet + [helmet[0]]), fill=(255, 215, 106, 255), width=w(5), joint="curve")

    # Ear plates.
    left_ear = [(170, 236), (144, 236), (132, 298), (150, 360), (168, 344), (158, 300)]
    right_ear = [(512 - px, py) for px, py in left_ear]
    for ear in (left_ear, right_ear):
        sd.polygon(pts(ear), fill=(141, 17, 25, 255), outline=(255, 215, 106, 255), width=w(3))

    # --- gold faceplate ---------------------------------------------------
    face = [
        (256, 112), (300, 124), (322, 164), (328, 206), (328, 276), (314, 334),
        (288, 376), (256, 398), (224, 376), (198, 334), (184, 276), (184, 206),
        (190, 164), (212, 124),
    ]
    sd.polygon(pts(face), fill=(232, 182, 74, 255), outline=(255, 243, 196, 255), width=w(2))
    sd.line(pts([(256, 132), (256, 398)]), fill=(180, 129, 31, 130), width=w(2))
    sd.line(pts([(206, 186), (232, 176), (280, 176), (306, 186)]), fill=(180, 129, 31, 150), width=w(3))

    # --- glowing eyes -----------------------------------------------------
    left_eye = [(203, 210), (246, 216), (242, 240), (203, 233)]
    right_eye = [(512 - px, py) for px, py in left_eye]
    eye_glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ed = ImageDraw.Draw(eye_glow)
    for eye in (left_eye, right_eye):
        ed.polygon(pts(eye), fill=(143, 232, 255, 255))
    canvas.alpha_composite(eye_glow.filter(ImageFilter.GaussianBlur(radius=10 * s)))
    canvas.alpha_composite(shell)
    canvas.alpha_composite(eye_glow)

    # --- mouth grille -----------------------------------------------------
    detail = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    dd = ImageDraw.Draw(detail)
    for row, (x0, x1) in enumerate(((222, 290), (229, 283), (237, 275))):
        yy = 330 + row * 16
        dd.line([(x(x0), y(yy)), (x(x1), y(yy))], fill=(124, 90, 36, 255), width=w(4))
    dd.polygon(
        pts([(256, 286), (273, 316), (256, 330), (239, 316)]),
        fill=(232, 182, 74, 255),
        outline=(124, 90, 36, 255),
        width=w(2),
    )

    # --- arc-blue specular points ----------------------------------------
    for px, py, r in ((256, 252, 5), (130, 158, 4), (386, 348, 5), (112, 344, 3)):
        rr = r * scale * s
        dd.ellipse(
            [x(px) - rr, y(py) - rr, x(px) + rr, y(py) + rr],
            fill=(143, 232, 255, 210),
        )

    # --- gold corner cuts -------------------------------------------------
    for x0, y0, dx, dy in ((206, 94, 14, 16), (306, 94, -14, 16), (414, 252, -22, 0), (120, 252, -22, 0)):
        dd.line([(x(x0), y(y0)), (x(x0 + dx), y(y0 + dy))], fill=(255, 215, 106, 220), width=w(3))

    canvas.alpha_composite(detail)
    return canvas


def render(size: int, scale: float = 1.0) -> Image.Image:
    art = draw_art(MASTER, scale)
    small = art.resize((size, size), Image.Resampling.LANCZOS)
    base = background(size)
    base.alpha_composite(small)
    return base


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    render(512).convert("RGB").save(OUT / "icon-512.png", optimize=True)
    render(192).convert("RGB").save(OUT / "icon-192.png", optimize=True)
    render(512, scale=0.74).convert("RGB").save(OUT / "icon-maskable-512.png", optimize=True)
    print("wrote icon-192.png, icon-512.png, icon-maskable-512.png")


if __name__ == "__main__":
    main()
