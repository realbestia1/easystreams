const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execAsync = util.promisify(exec);
const { sanitizeLogText } = require('./src/utils/log_sanitizer');

class FlareSolverrManager {
    constructor() {
        this.process = null;
        this.fsDir = path.join(__dirname, 'flaresolverr-bin');
        this.zipPath = path.join(__dirname, 'flaresolverr.zip');
        this.isStarting = false;
        this.port = '8191';
    }

    getLocalExecutablePath() {
        const isWin = process.platform === 'win32';
        let exePath = isWin
            ? path.join(this.fsDir, 'flaresolverr.exe')
            : path.join(this.fsDir, 'flaresolverr');

        if (!isWin && fs.existsSync(exePath) && fs.statSync(exePath).isDirectory()) {
            exePath = path.join(exePath, 'flaresolverr');
        }

        if (isWin && !fs.existsSync(exePath)) {
            exePath = path.join(this.fsDir, 'flaresolverr', 'flaresolverr.exe');
        }

        return exePath;
    }

    isLocalRuntimeValid() {
        if (process.env.IN_DOCKER === 'true') return true;

        const exePath = this.getLocalExecutablePath();
        if (!fs.existsSync(exePath)) return false;

        if (process.platform !== 'win32') return true;

        const internalDir = path.join(path.dirname(exePath), '_internal');
        if (!fs.existsSync(internalDir)) return false;

        const hasPythonDll = fs.existsSync(path.join(internalDir, 'python313.dll'))
            || fs.existsSync(path.join(internalDir, 'python312.dll'))
            || fs.existsSync(path.join(internalDir, 'python311.dll'))
            || fs.existsSync(path.join(internalDir, 'python310.dll'));
        const hasPythonStdlib = fs.existsSync(path.join(internalDir, 'base_library.zip'))
            || fs.existsSync(path.join(internalDir, 'encodings'));

        return hasPythonDll && hasPythonStdlib;
    }

    async execCommand(command, cwd = process.cwd()) {
        try {
            await execAsync(command, { cwd });
        } catch (e) {
            console.error(`[FlareSolverr] Errore comando "${command}":`, e.message);
            throw e;
        }
    }

    async cleanupWindowsDriverLocks() {
        if (process.platform !== 'win32') return;

        const appData = process.env.APPDATA || '';
        const ucDir = appData ? path.join(appData, 'undetected_chromedriver') : '';
        const escapedRoot = __dirname.replace(/'/g, "''").toLowerCase();
        const escapedUcDir = ucDir.replace(/'/g, "''").toLowerCase();

        try {
            await execAsync(`powershell -NoProfile -Command "$targets = Get-CimInstance Win32_Process | Where-Object { $p = ($_.ExecutablePath + '').ToLower(); ($_.Name -in @('chrome.exe','chromedriver.exe','flaresolverr.exe')) -and ($p.StartsWith('${escapedRoot}') -or $p.StartsWith('${escapedUcDir}')) }; foreach ($t in $targets) { Stop-Process -Id $t.ProcessId -Force -ErrorAction SilentlyContinue }"`);
        } catch (e) {
            console.error('[FlareSolverr] Pulizia processi driver non riuscita:', e.message);
        }

        if (!ucDir || !fs.existsSync(ucDir)) return;

        for (const file of ['chromedriver.exe', 'undetected_chromedriver.exe']) {
            const filePath = path.join(ucDir, file);
            if (!fs.existsSync(filePath)) continue;
            try {
                fs.unlinkSync(filePath);
                console.log(`[FlareSolverr] Rimosso driver cache bloccabile: ${filePath}`);
            } catch (e) {
                console.error(`[FlareSolverr] Impossibile rimuovere ${filePath}: ${e.message}`);
            }
        }
    }

    async start() {
        if (this.process) return;
        if (this.isStarting) return;
        this.isStarting = true;

        const isWin = process.platform === 'win32';

        try {
            if (isWin) {
                await this.cleanupWindowsDriverLocks();
            }

            const needsInstall = process.env.IN_DOCKER !== 'true' && (!fs.existsSync(this.fsDir) || !this.isLocalRuntimeValid());
            if (needsInstall) {
                if (fs.existsSync(this.fsDir)) {
                    console.log('[FlareSolverr] Installazione locale corrotta o incompleta, reinstallazione in corso...');
                    try {
                        fs.rmSync(this.fsDir, { recursive: true, force: true });
                    } catch (e) {
                        console.error('[FlareSolverr] Impossibile rimuovere installazione corrotta:', e.message);
                    }
                }
                console.log('[FlareSolverr] Installazione automatica in corso...');
                let downloadUrl;
                if (isWin) {
                    downloadUrl = 'https://github.com/FlareSolverr/FlareSolverr/releases/latest/download/flaresolverr_windows_x64.zip';
                } else {
                    const arch = process.arch;
                    if (arch === 'arm64') {
                        downloadUrl = 'https://github.com/FlareSolverr/FlareSolverr/releases/latest/download/flaresolverr_linux_aarch64.tar.gz';
                    } else if (arch === 'arm') {
                        downloadUrl = 'https://github.com/FlareSolverr/FlareSolverr/releases/latest/download/flaresolverr_linux_armv7l.tar.gz';
                    } else {
                        downloadUrl = 'https://github.com/FlareSolverr/FlareSolverr/releases/latest/download/flaresolverr_linux_x64.tar.gz';
                    }
                }
                
                console.log('[FlareSolverr] Download del pacchetto...');
                if (isWin) {
                    await this.execCommand(`powershell -Command "Invoke-WebRequest -Uri '${downloadUrl}' -OutFile '${this.zipPath}'"`);
                    console.log('[FlareSolverr] Estrazione file...');
                    if (!fs.existsSync(this.fsDir)) fs.mkdirSync(this.fsDir);
                    await this.execCommand(`powershell -Command "Expand-Archive -Path '${this.zipPath}' -DestinationPath '${this.fsDir}' -Force"`);
                } else {
                    const tarPath = path.join(__dirname, 'flaresolverr.tar.gz');
                    await this.execCommand(`curl -L '${downloadUrl}' -o '${tarPath}'`);
                    console.log('[FlareSolverr] Estrazione file...');
                    if (!fs.existsSync(this.fsDir)) fs.mkdirSync(this.fsDir);
                    await this.execCommand(`tar -xzf '${tarPath}' -C '${this.fsDir}' --strip-components=1`);
                    if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);
                    const exePath = path.join(this.fsDir, 'flaresolverr');
                    if (fs.existsSync(exePath)) {
                        console.log('[FlareSolverr] Impostazione permessi ricorsivi...');
                        await this.execCommand(`chmod -R 755 '${this.fsDir}'`);
                    }
                }
                
                // Debug: list files and permissions
                try {
                    console.log('[FlareSolverr] Verifica file in ' + this.fsDir + ':');
                    const files = fs.readdirSync(this.fsDir);
                    files.forEach(file => {
                        const stats = fs.statSync(path.join(this.fsDir, file));
                        console.log(` - ${file} [mode: ${stats.mode.toString(8)}]`);
                    });
                } catch (de) {}

                // Pulizia zip/tar
                if (fs.existsSync(this.zipPath)) fs.unlinkSync(this.zipPath);
                const tarPathTmp = path.join(process.cwd(), 'flaresolverr.tar.gz');
                if (fs.existsSync(tarPathTmp)) fs.unlinkSync(tarPathTmp);
                
                console.log('[FlareSolverr] Installazione completata.');
            }

            // Imposta i permessi e debug ad ogni avvio
            if (!isWin) {
                const exePath = path.join(this.fsDir, 'flaresolverr');
                if (fs.existsSync(exePath)) {
                    console.log('[FlareSolverr] Verifica permessi esecuzione...');
                    try {
                        await this.execCommand(`chmod -R 755 '${this.fsDir}'`);
                    } catch (e) {
                        console.error('[FlareSolverr] Errore durante chmod:', e.message);
                    }
                }
                
                // Debug: list files and permissions
                try {
                    console.log('[FlareSolverr] Stato cartella ' + this.fsDir + ':');
                    const files = fs.readdirSync(this.fsDir);
                    files.forEach(file => {
                        const filePath = path.join(this.fsDir, file);
                        const stats = fs.statSync(filePath);
                        console.log(` - ${file} [mode: ${stats.mode.toString(8)}]`);
                    });
                } catch (de) {}
            }
        } catch (e) {
            console.error('[FlareSolverr] Errore durante preparazione:', e.message);
        }

        console.log('[FlareSolverr] Avvio servizio...');

        return new Promise((resolve, reject) => {
            let exePath;
            let spawnArgs = [];

            if (process.env.IN_DOCKER === 'true') {
                // In Docker usiamo la versione installata dai sorgenti (stile EasyProxy)
                exePath = 'python3';
                spawnArgs = ['/app/flaresolverr-src/src/flaresolverr.py'];
                console.log('[FlareSolverr] Avvio da sorgenti Python (Docker Mode)...');
            } else {
                // Su Windows o installazione locale manuale
                exePath = this.getLocalExecutablePath();

                if (!fs.existsSync(exePath)) {
                    console.error('[FlareSolverr] Eseguibile non trovato in:', exePath);
                    this.isStarting = false;
                    return resolve();
                }

                // Ultimo controllo permessi sul file reale
                if (!isWin) {
                    try {
                        fs.chmodSync(exePath, 0o755);
                    } catch (e) {}
                }
            }

            try {
                const browserTimeout = String(process.env.FLARE_BROWSER_TIMEOUT_MS || process.env.BROWSER_TIMEOUT || '40000');
                const logLevel = String(process.env.FLARE_LOG_LEVEL || 'info');
                this.process = spawn(exePath, spawnArgs, {
                    cwd: process.env.IN_DOCKER === 'true' ? '/app/flaresolverr-src' : path.dirname(exePath),
                    stdio: 'pipe',
                    env: { ...process.env, PORT: this.port, HOST: '0.0.0.0', LOG_LEVEL: logLevel, HEADLESS: 'true', BROWSER_TIMEOUT: browserTimeout },
                    shell: !isWin
                });
            } catch (spawnError) {
                console.error('[FlareSolverr] Errore critico durante lo spawn:', spawnError.message);
                this.isStarting = false;
                return resolve();
            }

            this.process.on('error', (err) => {
                console.error('[FlareSolverr] Errore avvio processo:', err.message);
                this.isStarting = false;
                resolve();
            });

            if (this.process && !this.process.killed) {
                this.setupListeners(resolve);
            }

            // Timeout di sicurezza
            setTimeout(() => {
                if (this.isStarting) {
                    console.log('[FlareSolverr] Timeout avvio raggiunto, procedo...');
                    this.isStarting = false;
                    resolve();
                }
            }, 30000);
        });
    }

    setupListeners(resolve) {
        if (!this.process) return;

        this.process.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('Serving on http') || output.includes('address already in use')) {
                if (output.includes('address already in use')) {
                    console.log('[FlareSolverr] Porta 8191 già in uso, utilizzo istanza esistente.');
                } else {
                    console.log('[FlareSolverr] Servizio avviato e pronto sulla porta ' + this.port);
                }
                this.isStarting = false;
                resolve();
            }
            console.log('[FlareSolverr-Log]', sanitizeLogText(output.trim()));
        });

        this.process.stderr.on('data', (data) => {
            const output = data.toString();
            console.error('[FlareSolverr-Stderr]', sanitizeLogText(output.trim()));
            if (output.includes('address already in use')) {
                console.log('[FlareSolverr] Porta 8191 già in uso (stderr), utilizzo istanza esistente.');
                this.isStarting = false;
                resolve();
            }
        });

        this.process.on('close', (code) => {
            console.log(`[FlareSolverr] Processo chiuso con codice ${code}.`);
            if (this.isStarting) {
                this.isStarting = false;
                resolve();
            }
            this.process = null;
            
            // Auto-restart se non è stato spento intenzionalmente
            if (code !== 0 && code !== null) {
                console.log('[FlareSolverr] Rilevato crash, riavvio automatico tra 5 secondi...');
                setTimeout(() => this.start(), 5000);
            }
        });
    }

    stop() {
        if (this.process) {
            console.log('[FlareSolverr] Arresto servizio...');
            this.process.kill('SIGTERM');
            this.process = null;
        }
    }
}

module.exports = new FlareSolverrManager();
