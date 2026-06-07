import os
import sys
import collections

try:
    from PIL import Image, ImageFilter
    import numpy as np
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "numpy"])
    from PIL import Image, ImageFilter
    import numpy as np

def soften_stripes(img):
    # img is a PIL RGBA Image
    # Convert to RGB numpy array for processing
    rgb_img = img.convert("RGB")
    w, h = img.size
    
    # 1. Apply Gaussian blur to the entire image for texture smoothing
    blurred_img = rgb_img.filter(ImageFilter.GaussianBlur(radius=3.0))
    
    # Convert to numpy arrays
    orig_arr = np.array(rgb_img, dtype=np.float32)
    blur_arr = np.array(blurred_img, dtype=np.float32)
    
    # Compute brightness
    orig_brightness = np.mean(orig_arr, axis=2)
    
    # R, G, B channels
    r, g, b = orig_arr[:, :, 0], orig_arr[:, :, 1], orig_arr[:, :, 2]
    
    # 2. Golden fur mask (to exclude eyes, collar, nose, and pure white/black areas)
    gold_mask = (r > g + 8) & (g > b + 8) & (orig_brightness > 70) & (orig_brightness < 240)
    
    # Create soft mask
    mask_img = Image.fromarray((gold_mask * 255.0).astype(np.uint8), mode='L')
    soft_mask_img = mask_img.filter(ImageFilter.GaussianBlur(radius=1.5))
    soft_mask = np.array(soft_mask_img, dtype=np.float32) / 255.0
    
    # 3. Lift dark gold pixels to reduce stripe contrast
    lift_factor = 0.50
    target_brightness = 200.0
    
    new_brightness = np.where(
        orig_brightness < target_brightness,
        orig_brightness + (target_brightness - orig_brightness) * lift_factor,
        orig_brightness
    )
    
    scale = np.where(orig_brightness > 0, new_brightness / orig_brightness, 1.0)
    scale = np.clip(scale, 1.0, 1.8)
    
    lifted_orig = orig_arr * scale[..., np.newaxis]
    lifted_orig = np.clip(lifted_orig, 0.0, 255.0)
    
    # 4. Blend the lifted original image and the blurred image
    blur_weight = 0.65
    blended_fur = lifted_orig * (1.0 - blur_weight) + blur_arr * blur_weight
    
    # 5. Composite back using the soft mask
    final_rgb = orig_arr * (1.0 - soft_mask[..., np.newaxis]) + blended_fur * soft_mask[..., np.newaxis]
    final_rgb = np.clip(final_rgb, 0.0, 255.0).astype(np.uint8)
    
    # Reconstruct RGBA Image
    _, _, _, orig_alpha = img.split()
    final_rgba_img = Image.merge("RGBA", (
        Image.fromarray(final_rgb[:, :, 0]),
        Image.fromarray(final_rgb[:, :, 1]),
        Image.fromarray(final_rgb[:, :, 2]),
        orig_alpha
    ))
    return final_rgba_img

def make_transparent_advanced(raw_image_path, output_image_path):
    if not os.path.exists(raw_image_path):
        print(f"File not found: {raw_image_path}")
        return
    
    print(f"Processing {raw_image_path} -> {output_image_path}...")
    img = Image.open(raw_image_path).convert("RGBA")
    
    # 0. 고양이 털 겹침 부위의 어두운 줄무늬 부드럽게 완화 (Contrast Reduction & Smooth)
    img = soften_stripes(img)
    
    w, h = img.size
    
    # 1. NumPy 배열로 변환 (Float32로 정밀 연산)
    arr = np.array(img, dtype=np.float32)
    rgb = arr[:, :, :3]
    
    # 2. 너비 우선 탐색(BFS)을 통한 고화질 배경 영역 추출
    # 이미지 모서리에서 시작하여 명도(brightness)가 T 이상인 off-white 배경 픽셀만 탐색
    T = 242.0
    bg_mask = np.zeros((h, w), dtype=bool)
    visited = np.zeros((h, w), dtype=bool)
    
    queue = collections.deque()
    # 상하좌우 테두리 전체를 초기 큐에 추가
    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
        visited[0, x] = True
        visited[h - 1, x] = True
    for y in range(h):
        queue.append((0, y))
        queue.append((w - 1, y))
        visited[y, 0] = True
        visited[y, w - 1] = True
        
    while queue:
        x, y = queue.popleft()
        r, g, b = rgb[y, x]
        brightness = (r + g + b) / 3.0
        # 이미지 전체에 대해 안전한 임계값인 T를 적용하여 탐색 유입(Leak) 원천 차단
        if brightness >= T:
            bg_mask[y, x] = True
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    if not visited[ny, nx]:
                        visited[ny, nx] = True
                        queue.append((nx, ny))

    # 고양이 본체 마스크 (배경이 아닌 영역)
    cat_mask = ~bg_mask
    
    # 3. 알파 채널 생성 및 가우시안 페더링(Feathering)
    # 초기 마스크: 고양이는 255(완전 불투명), 배경은 0(완전 투명)
    alpha = np.where(cat_mask, 255.0, 0.0)
    
    # [NEW] 바닥 회색 그림자 및 외곽 잔상 완화를 위한 선택적 소프트 매팅 (Boundary-Zone Soft Matting)
    # bg_mask를 4픽셀 확장하여 경계면 주변 영역(boundary_zone)을 정의합니다.
    bg_mask_img = Image.fromarray(bg_mask.astype(np.uint8) * 255, mode='L')
    # MaxFilter(9)는 경계선에서 안쪽으로 약 4픽셀 범위의 존을 생성
    boundary_zone_img = bg_mask_img.filter(ImageFilter.MaxFilter(size=9))
    boundary_zone = np.array(boundary_zone_img, dtype=bool)
    
    # 경계 구역에 있는 밝은 회색 그림자(명도 T-25~T)에 대해 부드러운 알파 감쇄를 적용
    raw_brightness = np.mean(rgb, axis=2)
    soft_factor = np.clip(1.0 - (raw_brightness - (T - 25.0)) / 25.0, 0.0, 1.0)
    
    # 경계 구역(boundary_zone)이면서 고양이 영역(cat_mask)인 픽셀에만 소프트 매팅 적용
    # 몸통 안쪽(뺨, 가슴 등)은 경계 구역 밖이므로 100% 불투명하게 보존됨
    alpha = np.where(cat_mask & boundary_zone, alpha * soft_factor, alpha)
    
    # 알파 채널을 Pillow 이미지로 변환 후 가우시안 블러 적용하여 경계선 부드럽게 뭉갬
    alpha_img = Image.fromarray(alpha.astype(np.uint8), mode='L')
    # 솜털 끝부분이 배경에 부드럽게 스며들도록 적정 반경인 1.5로 블러 처리
    feathered_alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=1.5))
    feathered_alpha = np.array(feathered_alpha_img, dtype=np.float32)

    # 4. 컬러 블리딩 (Push-Pull Dilation을 통한 외곽선 색상 확장)
    # 외곽 반투명 영역에서 배경 흰색이 섞여 들어오는 현상(White Halo)을 원천 차단하기 위해
    # 고양이 경계면 바깥쪽으로 고양이 털 고유의 색상을 인접 픽셀로 확장합니다.
    
    # 배경 영역의 색상을 (0,0,0)으로 세팅하여 고양이 본체 색상만 남김
    premult_rgb = rgb * cat_mask[..., np.newaxis]
    
    # Pillow의 초고속 C 연산 가우시안 필터 활용을 위해 Pillow 이미지로 랩핑
    premult_img = Image.fromarray(premult_rgb.astype(np.uint8), mode='RGB')
    blurred_premult_img = premult_img.filter(ImageFilter.GaussianBlur(radius=8.0))
    blurred_premult = np.array(blurred_premult_img, dtype=np.float32)
    
    # 가중치 분모가 될 바이너리 알파 마스크도 동일 반경으로 블러 처리
    binary_alpha_img = Image.fromarray((cat_mask * 255.0).astype(np.uint8), mode='L')
    blurred_alpha_img = binary_alpha_img.filter(ImageFilter.GaussianBlur(radius=8.0))
    blurred_alpha = np.array(blurred_alpha_img, dtype=np.float32) / 255.0
    
    # 분모 0 방지 처리를 적용한 채널 나눗셈으로 순수 색상 복원 및 확장
    epsilon = 1e-5
    dilated_rgb = blurred_premult / (blurred_alpha[..., np.newaxis] + epsilon)
    dilated_rgb = np.clip(dilated_rgb, 0.0, 255.0)
    
    # 고양이 안쪽은 원본 고유 색상을 100% 유지하고, 경계선 및 바깥쪽만 색상 확장 적용
    final_rgb = np.where(cat_mask[..., np.newaxis], rgb, dilated_rgb)
    
    # 5. 최종 이미지 합성 및 저장
    final_rgba = np.zeros((h, w, 4), dtype=np.uint8)
    final_rgba[:, :, :3] = final_rgb.astype(np.uint8)
    final_rgba[:, :, 3] = feathered_alpha.astype(np.uint8)
    
    final_img = Image.fromarray(final_rgba, mode='RGBA')
    final_img.save(output_image_path, "PNG")
    print(f"Successfully processed and output to {output_image_path}")

if __name__ == "__main__":
    # raw/ 폴더의 고해상도 무테 이미지들을 assets/ 폴더로 고급 가공 처리하여 배포
    raw_dir = os.path.join("assets", "raw")
    assets_dir = "assets"
    
    for filename in ["maru_kitten.png", "maru_adult.png", "maru_loaf.png"]:
        raw_path = os.path.join(raw_dir, filename)
        out_path = os.path.join(assets_dir, filename)
        make_transparent_advanced(raw_path, out_path)
