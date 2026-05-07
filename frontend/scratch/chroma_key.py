import os
from PIL import Image
import shutil

def aggressive_8dir_flood_fill(file_path, backup_path=None):
    print(f"Aggressive 8-direction flood filling {file_path}...")
    
    if backup_path and os.path.exists(backup_path):
        shutil.copy(backup_path, file_path)
        
    img = Image.open(file_path).convert("RGB")
    pixels = img.load()
    width, height = img.size
    
    target_color = (0, 255, 0)
    
    # Sample multiple points from the corners to build a better background palette
    bg_palette = [img.getpixel((0,0)), img.getpixel((1,0)), img.getpixel((0,1)), img.getpixel((1,1))]
    tolerance = 50 # High tolerance to bridge noise/gradients
    
    visited = [[False for _ in range(height)] for _ in range(width)]
    queue = []
    # Start from all edges
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
        visited[x][0] = True
        visited[x][height-1] = True
    for y in range(1, height - 1):
        queue.append((0, y))
        queue.append((width - 1, y))
        visited[0][y] = True
        visited[width-1][y] = True
    
    while queue:
        x, y = queue.pop(0)
        r, g, b = pixels[x, y]
        
        is_bg = False
        for br, bg, bb in bg_palette:
            if abs(r - br) <= tolerance and abs(g - bg) <= tolerance and abs(b - bb) <= tolerance:
                is_bg = True
                break
        
        if is_bg:
            pixels[x, y] = target_color
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0: continue
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height and not visited[nx][ny]:
                        visited[nx][ny] = True
                        queue.append((nx, ny))
                    
    img.save(file_path)
    print(f"Done: {file_path}")

assets_path = r"z:\Gem Company\frontend\public\assets"
shutil.copy(os.path.join(assets_path, "floor_sheet - 복사본.png"), os.path.join(assets_path, "floor_sheet.png"))

files = ["floor_sheet.png", "furniture_sheet.png", "agent_sheet.png", "walls_sheet.png"]
for f in files:
    full_path = os.path.join(assets_path, f)
    if os.path.exists(full_path):
        aggressive_8dir_flood_fill(full_path)
