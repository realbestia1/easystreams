import sys
import base64
import ddddocr
import re

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
        'g': '9', 'G': '9', 'q': '9'
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

def solve_captcha(img_base64):
    try:
        ocr = ddddocr.DdddOcr(show_ad=False)
        img_data = base64.b64decode(img_base64)
        res = ocr.classification(img_data)
        
        # Normalizziamo il risultato
        final_res = normalize_numeric_captcha(res)
        return final_res
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
