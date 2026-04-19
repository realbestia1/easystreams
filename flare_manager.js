const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execAsync = util.promisify(exec);

class FlareSolverrManager {
    constructor() {
        this.process = null;
        this.fsDir = path.join(__dirname, 'flaresolverr-bin');
        this.zipPath = path.join(__dirname, 'flaresolverr.zip');
        this.isStarting = false;
        this.port = '8191';
    }

    async execCommand(command, cwd = process.cwd()) {
        try {
            await execAsync(command, { cwd });
        } catch (e) {
            console.error(`[FlareSolverr] Errore comando "${command}":`, e.message);
            throw e;
        }
    }

    async start() {
        if (this.process) return;
        if (this.isStarting) return;
        this.isStarting = true;

        const isWin = process.platform === 'win32';

        try {
            if (!fs.existsSync(this.fsDir)) {
                console.log('[FlareSolverr] Installazione automatica in corso...');
                const downloadUrl = isWin 
                    ? 'https://github.com/FlareSolverr/FlareSolverr/releases/latest/download/flaresolverr_windows_x64.zip'
                    : 'https://github.com/FlareSolverr/FlareSolverr/releases/latest/download/flaresolverr_linux_x64.tar.gz';
                
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
                        fs.chmodSync(exePath, 0o755);
                    }
                }
                
                // Pulizia zip/tar
                if (fs.existsSync(this.zipPath)) fs.unlinkSync(this.zipPath);
                const tarPath = path.join(process.cwd(), 'flaresolverr.tar.gz');
                if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);
                
                console.log('[FlareSolverr] Installazione completata.');
            }
        } catch (e) {
            console.error('[FlareSolverr] Errore durante installazione:', e.message);
        }

        console.log('[FlareSolverr] Avvio servizio...');

        return new Promise((resolve, reject) => {
            // Cerchiamo l'eseguibile
            let exePath = isWin 
                ? path.join(this.fsDir, 'flaresolverr.exe')
                : path.join(this.fsDir, 'flaresolverr');
            
            if (isWin && !fs.existsSync(exePath)) {
                exePath = path.join(this.fsDir, 'flaresolverr', 'flaresolverr.exe');
            }

            if (!fs.existsSync(exePath)) {
                console.error('[FlareSolverr] Eseguibile non trovato in:', exePath);
                this.isStarting = false;
                return resolve();
            }

            try {
                this.process = spawn(exePath, [], {
                    cwd: path.dirname(exePath),
                    stdio: 'pipe',
                    env: { ...process.env, PORT: this.port, HOST: '0.0.0.0', LOG_LEVEL: 'info', HEADLESS: 'true', BROWSER_TIMEOUT: '60000' }
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
            console.log('[FlareSolverr-Log]', output.trim());
        });

        this.process.stderr.on('data', (data) => {
            const output = data.toString();
            if (output.includes('address already in use')) {
                console.log('[FlareSolverr] Porta 8191 già in uso (stderr), utilizzo istanza esistente.');
                this.isStarting = false;
                resolve();
            }
            if (output.includes('error') || output.includes('Error')) {
                console.error('[FlareSolverr-Error]', output.trim());
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
