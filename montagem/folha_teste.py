import sys
from pathlib import Path
from PIL import Image
pasta = Path(sys.argv[1]); ims = sorted(pasta.glob("[0-9][0-9].png"))
w, h = 360, 450
f = Image.new("RGB", (w * 3 + 20, h * ((len(ims) + 2) // 3) + 10 * ((len(ims) + 2) // 3)), "#444")
for i, p in enumerate(ims):
    f.paste(Image.open(p).resize((w, h)), ((i % 3) * (w + 10), (i // 3) * (h + 10)))
f.save(pasta / "folha.jpg", quality=88)
