import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

MASTER_ICON_PATH = Path(r"C:\Users\VICTUS 16\.gemini\antigravity-ide\brain\a72d0651-b114-4e92-add7-1dffc7593b64\masked_icon_test.png")
ROUND_ICON_PATH = Path(r"C:\Users\VICTUS 16\.gemini\antigravity-ide\brain\a72d0651-b114-4e92-add7-1dffc7593b64\test_round_a.png")
RES_DIR = Path("android/app/src/main/res")

def create_splash(width, height, icon_img):
    splash = Image.new('RGB', (width, height), (239, 248, 245)) # #eff8f5
    
    # Scale icon according to portrait or landscape
    # In portrait, icon width is ~32% to 35% of width, min 100px, max 400px
    # In landscape, icon height is ~35% of height
    if height >= width: # portrait
        icon_size = max(100, min(int(width * 0.35), 400))
    else: # landscape
        icon_size = max(100, min(int(height * 0.40), 400))
        
    icon_resized = icon_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    
    # Soft shadow
    shadow_margin = max(16, int(icon_size * 0.2))
    shadow_w = icon_size + shadow_margin * 2
    shadow_h = icon_size + shadow_margin * 2
    shadow = Image.new('RGBA', (shadow_w, shadow_h), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    
    # shadow ellipse under icon
    ey1 = int(icon_size * 0.8) + shadow_margin
    ey2 = int(icon_size * 1.05) + shadow_margin
    ex1 = int(icon_size * 0.1) + shadow_margin
    ex2 = int(icon_size * 0.9) + shadow_margin
    sdraw.ellipse([ex1, ey1, ex2, ey2], fill=(20, 80, 60, 55))
    blur_radius = max(8, int(icon_size * 0.08))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur_radius))
    
    # Centered placement (slightly above geometric center for visual balance)
    cx = (width - icon_size) // 2
    cy = (height - icon_size) // 2 - int(icon_size * 0.05)
    
    splash.paste(shadow, (cx - shadow_margin, cy - shadow_margin), shadow)
    splash.paste(icon_resized, (cx, cy), icon_resized)
    return splash

def main():
    if not MASTER_ICON_PATH.exists():
        raise FileNotFoundError(f"Master icon not found: {MASTER_ICON_PATH}")
    
    master_icon = Image.open(MASTER_ICON_PATH).convert('RGBA')
    round_icon = Image.open(ROUND_ICON_PATH).convert('RGBA')
    
    # 1. Launcher icon sizes
    launcher_sizes = {
        'mipmap-mdpi': (48, 108),
        'mipmap-hdpi': (72, 162),
        'mipmap-xhdpi': (96, 216),
        'mipmap-xxhdpi': (144, 324),
        'mipmap-xxxhdpi': (192, 432),
    }
    
    print("Generating launcher icons...")
    for folder, (l_size, fg_size) in launcher_sizes.items():
        target_dir = RES_DIR / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        
        # Standard launcher (squircle)
        sq = master_icon.resize((l_size, l_size), Image.Resampling.LANCZOS)
        sq.save(target_dir / 'ic_launcher.png', optimize=True)
        
        # Round launcher
        rd = round_icon.resize((l_size, l_size), Image.Resampling.LANCZOS)
        rd.save(target_dir / 'ic_launcher_round.png', optimize=True)
        
        # Adaptive foreground
        fg = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
        # 66.6% safe zone
        inner = int(fg_size * 0.666)
        scaled_inner = master_icon.resize((inner, inner), Image.Resampling.LANCZOS)
        offset = (fg_size - inner) // 2
        fg.paste(scaled_inner, (offset, offset), scaled_inner)
        fg.save(target_dir / 'ic_launcher_foreground.png', optimize=True)
        
        print(f"  [OK] {folder}: launcher={l_size}x{l_size}, foreground={fg_size}x{fg_size}")
        
    # 2. Splash screens
    splash_configs = [
        ('drawable', 480, 320),
        ('drawable-port-mdpi', 320, 480),
        ('drawable-port-hdpi', 480, 800),
        ('drawable-port-xhdpi', 720, 1280),
        ('drawable-port-xxhdpi', 960, 1600),
        ('drawable-port-xxxhdpi', 1280, 1920),
        ('drawable-land-mdpi', 480, 320),
        ('drawable-land-hdpi', 800, 480),
        ('drawable-land-xhdpi', 1280, 720),
        ('drawable-land-xxhdpi', 1600, 960),
        ('drawable-land-xxxhdpi', 1920, 1280),
    ]
    
    print("\nGenerating splash screens...")
    for folder, w, h in splash_configs:
        target_dir = RES_DIR / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        splash_img = create_splash(w, h, master_icon)
        splash_img.save(target_dir / 'splash.png', optimize=True)
        print(f"  [OK] {folder}/splash.png ({w}x{h})")
        
    # 3. Public Web assets
    public_dir = Path("public")
    if public_dir.exists():
        p_icon = master_icon.resize((512, 512), Image.Resampling.LANCZOS)
        p_icon.save(public_dir / 'planner-icon.png', optimize=True)
        p_round = round_icon.resize((512, 512), Image.Resampling.LANCZOS)
        p_round.save(public_dir / 'planner-icon-round.png', optimize=True)
        print("  [OK] public/planner-icon.png (512x512)")
        
    print("\nAll assets generated successfully!")

if __name__ == '__main__':
    main()
