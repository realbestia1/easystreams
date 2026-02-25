const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Configuration
const PROVIDERS_DIR = path.join(__dirname, 'providers');
const SRC_DIR = path.join(__dirname, 'src');

async function build() {
    const args = process.argv.slice(2);
    const shouldTranspile = args.includes('--transpile');
    const shouldMinify = args.includes('--minify');
    
    // Filter out flags to get provider names
    const providerNames = args.filter(arg => !arg.startsWith('--'));

    if (shouldTranspile) {
        await transpileProviders(providerNames, shouldMinify);
    } else {
        await buildSourceProviders(providerNames, shouldMinify);
    }
}

async function transpileProviders(specificFiles = [], minify = false) {
    console.log('Transpiling providers...');
    
    if (!fs.existsSync(PROVIDERS_DIR)) {
        console.error('Providers directory not found!');
        return;
    }

    let files = fs.readdirSync(PROVIDERS_DIR).filter(f => f.endsWith('.js'));
    
    if (specificFiles.length > 0) {
        files = files.filter(f => specificFiles.includes(f) || specificFiles.includes(f.replace('.js', '')));
    }

    for (const file of files) {
        const filePath = path.join(PROVIDERS_DIR, file);
        console.log(`Processing ${file}...`);
        
        try {
            const result = await esbuild.build({
                entryPoints: [filePath],
                outfile: filePath,
                allowOverwrite: true,
                bundle: false, // Don't bundle for single file, just transpile
                minify: minify,
                platform: 'neutral',
                target: ['es2016'], // Target older ES version for Hermes compatibility
                format: 'cjs',
                define: {
                    'process.env.NODE_ENV': minify ? '"production"' : '"development"'
                }
            });
            console.log(`✅ Transpiled ${file}`);
        } catch (e) {
            console.error(`❌ Failed to transpile ${file}:`, e.message);
        }
    }
}

async function buildSourceProviders(specificProviders = [], minify = false) {
    if (!fs.existsSync(SRC_DIR)) {
        console.log('No src directory found. Skipping source build.');
        return;
    }

    let providers = fs.readdirSync(SRC_DIR).filter(f => fs.statSync(path.join(SRC_DIR, f)).isDirectory());

    if (specificProviders.length > 0) {
        providers = providers.filter(p => specificProviders.includes(p));
    }

    if (providers.length === 0) {
        console.log('No source providers to build.');
        return;
    }

    console.log('Building source providers...');

    if (!fs.existsSync(PROVIDERS_DIR)) {
        fs.mkdirSync(PROVIDERS_DIR);
    }

    for (const provider of providers) {
        const entryPoint = path.join(SRC_DIR, provider, 'index.js');
        const outFile = path.join(PROVIDERS_DIR, `${provider}.js`);

        if (!fs.existsSync(entryPoint)) {
            console.warn(`Skipping ${provider}: index.js not found.`);
            continue;
        }

        console.log(`Building ${provider}...`);

        try {
            await esbuild.build({
                entryPoints: [entryPoint],
                outfile: outFile,
                bundle: true,
                minify: minify,
                platform: 'neutral',
                target: ['es2016'],
                format: 'cjs',
                define: {
                    'process.env.NODE_ENV': minify ? '"production"' : '"development"'
                },
                // Bundle everything except potentially very large or platform-specific libs
                // For React Native/Nuvio, we generally want to bundle crypto-js 
                // but keep cheerio external if we want to avoid huge files (and we should avoid using it)
                external: ['cheerio', 'cheerio-select'] 
            });
            console.log(`✅ Built ${provider}`);
        } catch (e) {
            console.error(`❌ Failed to build ${provider}:`, e.message);
        }
    }
}

build().catch(console.error);
