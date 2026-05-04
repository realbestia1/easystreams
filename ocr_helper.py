import sys
import base64
import ddddocr
import re
from io import BytesIO

try:
    import cv2
    import numpy as np
    from PIL import Image
except Exception:
    cv2 = None
    np = None
    Image = None

def normalize_numeric_captcha(text):
    if not text:
        return ""
    # Mappatura caratteri comuni confusi dall'OCR
    mapping = {
        'o': '0', 'O': '0',
        'l': '1', 'I': '1', 'i': '1', '|': '1',
        'z': '2', 'Z': '2',
        's': '5', 'S': '5',
        'b': '8', 'B': '8',
        'g': '9', 'G': '9', 'q': '9',
        '子': '4', '牛': '4', '千': '4', '午': '4'
    }
    
    normalized = ""
    for char in text:
        if char.isdigit():
            normalized += char
        elif char in mapping:
            normalized += mapping[char]
        # Se non è un numero e non è in mapping, lo ignoriamo o lo lasciamo se vogliamo essere meno aggressivi
        # Ma dato che DeltaBit è SOLO numeri, è meglio filtrare
    
    # Rimuovi qualsiasi cosa che non sia un numero alla fine (giusto per sicurezza)
    return re.sub(r'[^0-9]', '', normalized)

def solve_uprot_components(ocr, img_data):
    if cv2 is None or np is None or Image is None:
        return ""

    try:
        image = Image.open(BytesIO(img_data)).convert("RGB")
        width, height = image.size
        if width < 90 or width > 220 or height < 30 or height > 90:
            return ""

        arr = np.array(image)
        for threshold in (145, 130, 115, 100):
            mask = (np.all(arr < threshold, axis=2)).astype("uint8") * 255
            count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
            boxes = []
            for idx in range(1, count):
                x, y, w, h, area = stats[idx]
                if area >= 25 and 5 <= w <= 42 and 8 <= h <= 42:
                    boxes.append((int(x), int(y), int(w), int(h), int(area)))

            boxes = sorted(boxes, key=lambda item: item[0])

            code = ""
            for x, y, w, h, _area in boxes:
                crop = mask[max(0, y - 5):min(mask.shape[0], y + h + 5), max(0, x - 5):min(mask.shape[1], x + w + 5)]
                if crop.size == 0:
                    continue
                bw = np.where(crop > 0, 0, 255).astype("uint8")
                big = cv2.resize(bw, None, fx=6, fy=6, interpolation=cv2.INTER_NEAREST)
                ok, encoded = cv2.imencode(".png", big)
                if not ok:
                    continue
                digit = normalize_numeric_captcha(ocr.classification(encoded.tobytes()))
                if len(digit) == 1:
                    code += digit

            if 3 <= len(code) <= 6:
                return code
    except Exception:
        return ""

    return ""

def solve_numeric_variants(ocr, img_data):
    if cv2 is None or np is None or Image is None:
        return ""

    candidates = []

    def add_candidate(image_array):
        ok, encoded = cv2.imencode(".png", image_array)
        if not ok:
            return
        value = normalize_numeric_captcha(ocr.classification(encoded.tobytes()))
        if 3 <= len(value) <= 6:
            candidates.append(value)

    try:
        image = Image.open(BytesIO(img_data)).convert("RGB")
        arr = np.array(image)
        gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)

        for threshold in range(80, 135, 10):
            _, bw = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY_INV)
            out = np.where(bw > 0, 0, 255).astype("uint8")
            big = cv2.resize(out, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
            add_candidate(big)

        for threshold in range(90, 135, 10):
            mask = (np.all(arr < threshold, axis=2)).astype("uint8") * 255
            out = np.where(mask > 0, 0, 255).astype("uint8")
            kernel = np.ones((2, 2), np.uint8)
            variants = [
                out,
                cv2.morphologyEx(out, cv2.MORPH_OPEN, kernel),
                cv2.morphologyEx(out, cv2.MORPH_CLOSE, kernel),
                cv2.dilate(out, kernel, iterations=1),
            ]
            for variant in variants:
                big = cv2.resize(variant, None, fx=4, fy=4, interpolation=cv2.INTER_NEAREST)
                add_candidate(big)

        if not candidates:
            return ""

        counts = {}
        for candidate in candidates:
            counts[candidate] = counts.get(candidate, 0) + 1

        return sorted(
            counts,
            key=lambda value: (counts[value], len(value)),
            reverse=True
        )[0]
    except Exception:
        return ""

def solve_captcha(img_base64):
    try:
        ocr = ddddocr.DdddOcr(show_ad=False)
        img_data = base64.b64decode(img_base64)
        component_res = solve_uprot_components(ocr, img_data)
        variant_res = solve_numeric_variants(ocr, img_data)

        res = ocr.classification(img_data)
        
        # Normalizziamo il risultato
        final_res = normalize_numeric_captcha(res)
        candidates = [value for value in (component_res, variant_res, final_res) if 3 <= len(value) <= 6]
        if not candidates:
            return final_res

        counts = {}
        for candidate in candidates:
            counts[candidate] = counts.get(candidate, 0) + 1

        return sorted(
            counts,
            key=lambda value: (counts[value], len(value)),
            reverse=True
        )[0]
    except Exception as e:
        return ""

if __name__ == "__main__":
    # Legge base64 da stdin
    input_data = sys.stdin.read().strip()
    if input_data:
        # Se il dato inizia con data:image/..., lo puliamo
        if "," in input_data:
            input_data = input_data.split(",")[1]
        
        print(solve_captcha(input_data))
