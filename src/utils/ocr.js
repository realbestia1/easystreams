/**
 * Risolve un captcha numerico da un'immagine in base64 usando ocr_helper.py
 * @param {string} imgBase64 Immagine in formato Base64
 * @returns {Promise<string>} Il testo riconosciuto
 */
async function solveNumericCaptcha(imgBase64) {
    const { spawn } = require('child_process');
    return new Promise((resolve, reject) => {
        try {
            // Rimuovi eventuale prefisso data:image/...;base64,
            const cleanBase64 = imgBase64.includes(',') ? imgBase64.split(',')[1] : imgBase64;
            
            const python = spawn('python', ['ocr_helper.py']);
            let result = '';
            let error = '';
            
            python.stdin.write(cleanBase64);
            python.stdin.end();
            
            python.stdout.on('data', (data) => { result += data.toString(); });
            python.stderr.on('data', (data) => { error += data.toString(); });
            
            python.on('close', (code) => {
                if (code !== 0) {
                    console.error('[OCR] Errore processo Python:', error);
                    return reject(new Error('OCR engine error'));
                }
                const solved = result.trim();
                resolve(solved);
            });
            
            python.on('error', (err) => {
                console.error('[OCR] Errore avvio Python:', err.message);
                reject(err);
            });
        } catch (e) {
            reject(e);
        }
    });
}

module.exports = { solveNumericCaptcha };
