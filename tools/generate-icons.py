#!/usr/bin/env python3
"""Render the PWA icon set from the same geometry as assets/icon.svg.

Requires Pillow and NumPy (development-time only; the game itself has no
runtime dependencies). Run from the repository root:

    python3 tools/generate-icons.py
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"
MASTER = 1024
SS = 3  # internal supersampling for the 1024 master


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def background(size: int) -> Image.Image:
    """Diagonal violet-to-black gradient with a warm central halo."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    u = (xx / (size - 1) + yy / (size - 1)) * 0.5
    v = yy / (size - 1)

    top = np.array([21, 8, 38], dtype=np.float32)
    mid = np.array([6, 1, 15], dtype=np.float32)
    bottom = np.array([28, 6, 41], dtype=np.float32)

    img = np.empty((size, size, 3), dtype=np.float32)
    for c in range(3):
        img[..., c] = np.where(
            v < 0.55,
            lerp(top[c], mid[c], v / 0.55),
            lerp(mid[c], bottom[c], (v - 0.55) / 0.45),
        )
    img *= (0.9 + u[..., None] * 0.14)

    cx = cy = size * 0.5
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy * 0.84) ** 2) / (size * 0.62)
    glow = np.clip(1.0 - dist, 0.0, 1.0) ** 2
    for c, amount in enumerate((255, 47, 142)):
        img[..., c] += glow * amount * 0.20
    for c, amount in enumerate((139, 92, 255)):
        img[..., c] += glow * amount * 0.10

    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def draw_art(size: int, scale: float = 1.0) -> Image.Image:
    """Draw the sigil on a transparent canvas at `size` pixels."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s = size / 512.0

    def p(v: float) -> float:
        return (256.0 + (v - 256.0) * scale) * s

    cx = cy = 256.0 * s
    unit = s * scale

    # --- backdrop grid ---------------------------------------------------
    grid = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for i in range(1, 8):
        q = i * 64 * s
        gd.line([(0, q), (size, q)], fill=(70, 244, 255, 16), width=max(1, int(s)))
        gd.line([(q, 0), (q, size)], fill=(70, 244, 255, 16), width=max(1, int(s)))
    gd.ellipse(
        [p(44), p(44), p(468), p(468)],
        outline=(70, 244, 255, 20),
        width=max(1, int(1.2 * s)),
    )
    canvas.alpha_composite(grid)

    # --- cyan reticle ----------------------------------------------------
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    ring_box = [p(104), p(104), p(408), p(408)]
    gd.ellipse(ring_box, outline=(70, 244, 255, 255), width=max(2, int(8 * unit)))
    for tick in (0, 90, 180, 270):
        a = math.radians(tick)
        inner = 184 * unit
        outer = 224 * unit
        gd.line(
            [
                (cx + math.cos(a) * inner, cy + math.sin(a) * inner),
                (cx + math.cos(a) * outer, cy + math.sin(a) * outer),
            ],
            fill=(70, 244, 255, 255),
            width=max(1, int(7 * unit)),
        )
    gd.ellipse(
        [p(140), p(140), p(372), p(372)],
        outline=(70, 244, 255, 100),
        width=max(1, int(1.5 * unit)),
    )

    # Dashed arc: 12 bright segments with breathing gaps.
    ring_r = 165 * unit
    for i in range(12):
        start = -24 + i * 30
        gd.arc(
            [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
            start=start,
            end=start + 21,
            fill=(70, 244, 255, 245),
            width=max(2, int(7 * unit)),
        )

    blur = glow.filter(ImageFilter.GaussianBlur(radius=13 * s * max(scale, 0.7)))
    canvas.alpha_composite(blur)
    canvas.alpha_composite(glow)

    # --- pink core -------------------------------------------------------
    core_glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cd = ImageDraw.Draw(core_glow)

    def diamond(r: float) -> list[tuple[float, float]]:
        return [(cx, cy - r * unit), (cx + r * unit, cy), (cx, cy + r * unit), (cx - r * unit, cy)]

    cd.polygon(diamond(112), fill=(255, 47, 142, 70))
    cd.line(diamond(112) + [diamond(112)[0]], fill=(255, 47, 142, 235), width=max(2, int(6 * unit)), joint="curve")
    cd.polygon(diamond(49), fill=(255, 47, 142, 255), outline=(255, 215, 242, 255), width=max(1, int(2.5 * unit)))
    cd.polygon(diamond(26), fill=(255, 211, 107, 255))

    halo = core_glow.filter(ImageFilter.GaussianBlur(radius=22 * s * max(scale, 0.7)))
    canvas.alpha_composite(halo)
    canvas.alpha_composite(core_glow)

    # --- satellite swarm nodes ------------------------------------------
    nodes = [
        (256, 92, 7, (89, 255, 168, 255)),
        (382, 162, 5, (89, 255, 168, 255)),
        (406, 322, 7, (89, 255, 168, 255)),
        (292, 414, 5, (89, 255, 168, 255)),
        (132, 376, 7, (89, 255, 168, 255)),
        (108, 196, 5, (89, 255, 168, 255)),
    ]
    node_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    nd = ImageDraw.Draw(node_layer)
    for x, y, r, color in nodes:
        rr = r * unit
        nd.ellipse([p(x) - rr, p(y) - rr, p(x) + rr, p(y) + rr], fill=color)
    node_glow = node_layer.filter(ImageFilter.GaussianBlur(radius=9 * s))
    canvas.alpha_composite(node_glow)
    canvas.alpha_composite(node_layer)

    # --- gold corner cuts ------------------------------------------------
    cuts = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    kd = ImageDraw.Draw(cuts)
    for x, y, dx, dy in [
        (174, 134, 16, 16),
        (338, 362, 16, 16),
        (356, 146, -14, 14),
        (156, 356, 14, 14),
    ]:
        kd.line(
            [(p(x), p(y)), (p(x + dx), p(y + dy))],
            fill=(255, 200, 87, 210),
            width=max(1, int(3 * unit)),
        )
    canvas.alpha_composite(cuts)

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
