"""
generate_icons.py
─────────────────
Gera todos os ícones do TradePro em PNG usando apenas a lib padrão do Python.
Execute: python generate_icons.py

Requer: Pillow  →  pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os, math

SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
OUT_DIR = "public/icons"
os.makedirs(OUT_DIR, exist_ok=True)

def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    # Fundo com gradiente simulado (círculo com cor)
    margin = int(size * 0.06)
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=int(size * 0.22),
        fill=(0, 0, 0, 255),
        outline=None,
    )

    # Círculo gradiente de fundo
    cx, cy, r = size // 2, size // 2, int(size * 0.38)
    for i in range(r, 0, -1):
        ratio = i / r
        # Gradiente de #00D4FF → #BF5AF2
        rr = int(0 + (191 - 0) * (1 - ratio))
        gg = int(212 + (90 - 212) * (1 - ratio))
        bb = int(255 + (242 - 255) * (1 - ratio))
        alpha = int(40 + 60 * (1 - ratio))
        draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(rr, gg, bb, alpha))

    # Letra "T" estilizada
    font_size = int(size * 0.52)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()

    text = "T"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = (size - th) // 2 - bbox[1] - int(size * 0.02)

    # Sombra
    draw.text((tx + 2, ty + 2), text, font=font, fill=(0, 0, 0, 180))
    # Texto branco
    draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))

    # Ponto laranja no canto inferior direito (indicador "ao vivo")
    dot_r = int(size * 0.09)
    dot_x = size - margin - dot_r
    dot_y = size - margin - dot_r
    draw.ellipse(
        [dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r],
        fill=(48, 209, 88, 255),
    )

    return img

for s in SIZES:
    icon = draw_icon(s)
    path = f"{OUT_DIR}/icon-{s}x{s}.png"
    icon.save(path, "PNG")
    print(f"✅ Gerado: {path}")

# Apple Touch Icon (180x180)
apple = draw_icon(180)
apple.save("public/apple-touch-icon.png", "PNG")
print("✅ Gerado: public/apple-touch-icon.png")

# Favicon pequeno
fav = draw_icon(32)
fav.save("public/favicon.ico", "ICO", sizes=[(32, 32)])
print("✅ Gerado: public/favicon.ico")

print("\n🎉 Todos os ícones gerados em public/icons/")
print("   Execute 'npm run build' em seguida.")
