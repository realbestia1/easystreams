/**
 * Risolve un captcha numerico da un'immagine in base64 usando ocr_helper.py
 * @param {string} imgBase64 Immagine in formato Base64
 * @returns {Promise<string>} Il testo riconosciuto
 */
async function solveNumericCaptcha(imgBase64) {
    const { spawn } = require('child_process');
    const candidates = [
        process.env.PYTHON_BIN,
        process.platform === 'win32' ? 'python' : 'python3',
        process.platform === 'win32' ? 'py' : 'python'
    ].filter(Boolean);

    const trySolve = (pythonBin, allowFallback) => new Promise((resolve, reject) => {
        try {
            // Rimuovi eventuale prefisso data:image/...;base64,
            const cleanBase64 = imgBase64.includes(',') ? imgBase64.split(',')[1] : imgBase64;
            
            const python = spawn(pythonBin, ['ocr_helper.py']);
            let result = '';
            let error = '';
            
            python.stdin.write(cleanBase64);
            python.stdin.end();
            
            python.stdout.on('data', (data) => { result += data.toString(); });
            python.stderr.on('data', (data) => { error += data.toString(); });
            
            python.on('close', (code) => {
                if (code !== 0) {
                    console.error(`[OCR] Errore processo Python (${pythonBin}):`, error);
                    return reject(new Error('OCR engine error'));
                }
                const solved = result.trim();
                resolve(solved);
            });
            
            python.on('error', (err) => {
                if (!allowFallback) console.error(`[OCR] Errore avvio Python (${pythonBin}):`, err.message);
                reject(err);
            });
        } catch (e) {
            reject(e);
        }
    });

    let lastError = null;
    for (let i = 0; i < candidates.length; i++) {
        try {
            return await trySolve(candidates[i], i < candidates.length - 1);
        } catch (e) {
            lastError = e;
            if (e && e.code && e.code !== 'ENOENT') break;
        }
    }
    throw lastError || new Error('OCR engine error');
}

module.exports = { solveNumericCaptcha };
