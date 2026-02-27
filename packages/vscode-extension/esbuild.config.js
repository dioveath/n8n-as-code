const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Plugin to copy skills assets and CLI assets
const copySkillsAssets = {
    name: 'copy-skills-assets',
    setup(build) {
        build.onEnd(() => {
            const skillsAssetsDir = path.join(
                __dirname,
                'node_modules',
                '@n8n-as-code',
                'skills',
                'dist',
                'assets'
            );

            // Fallback to local workspace for development
            const fallbackAssetsDir = path.join(__dirname, '..', 'skills', 'dist', 'assets');

            const sourceDir = fs.existsSync(skillsAssetsDir) ? skillsAssetsDir : fallbackAssetsDir;
            const targetDir = path.join(__dirname, 'assets');

            if (!fs.existsSync(sourceDir)) {
                console.warn('⚠️  skills assets not found, skipping copy');
            } else {
                // Create target directory
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                // Copy JSON files
                const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.json'));
                for (const file of files) {
                    const src = path.join(sourceDir, file);
                    const dest = path.join(targetDir, file);
                    fs.copyFileSync(src, dest);
                    console.log(`✅ Copied ${file} to assets/`);
                }
            }

            // Copy n8n-workflows.d.ts from CLI package to out/assets/
            // so WorkspaceSetupService can find it at runtime inside the extension bundle.
            const cliAssetSrc = fs.existsSync(
                path.join(__dirname, 'node_modules', '@n8n-as-code', 'cli', 'dist', 'core', 'assets', 'n8n-workflows.d.ts')
            )
                ? path.join(__dirname, 'node_modules', '@n8n-as-code', 'cli', 'dist', 'core', 'assets', 'n8n-workflows.d.ts')
                : path.join(__dirname, '..', 'cli', 'dist', 'core', 'assets', 'n8n-workflows.d.ts');

            const cliAssetDest = path.join(__dirname, 'out', 'assets', 'n8n-workflows.d.ts');

            if (fs.existsSync(cliAssetSrc)) {
                fs.mkdirSync(path.dirname(cliAssetDest), { recursive: true });
                fs.copyFileSync(cliAssetSrc, cliAssetDest);
                console.log(`✅ Copied n8n-workflows.d.ts to out/assets/`);
            } else {
                console.warn(`⚠️  n8n-workflows.d.ts not found at ${cliAssetSrc}, skipping copy`);
            }
        });
    }
};

// Build configuration for Extension
const extensionBuild = esbuild.build({
    entryPoints: ['./src/extension.ts'],
    bundle: true,
    outfile: 'out/extension.js',
    external: ['vscode', 'prettier'],
    format: 'cjs',
    platform: 'node',
    logOverride: {
        'empty-import-meta': 'silent'
    },
    plugins: [copySkillsAssets]
});

// Build configuration for Skills CLI (Portable version for VS Code)
const skillsCliEntry = path.join(__dirname, 'node_modules', '@n8n-as-code', 'skills', 'dist', 'cli.js');
const fallbackSkillsCliEntry = path.join(__dirname, '..', 'skills', 'dist', 'cli.js');
const finalSkillsCliEntry = fs.existsSync(skillsCliEntry) ? skillsCliEntry : fallbackSkillsCliEntry;

if (!fs.existsSync(finalSkillsCliEntry)) {
    console.warn('⚠️  skills entry point not found, skipping CLI bundle');
}

const skillsCliBuild = fs.existsSync(finalSkillsCliEntry) ? esbuild.build({
    entryPoints: [finalSkillsCliEntry],
    bundle: true,
    outfile: 'out/skills/cli.js',
    external: ['vscode', 'prettier'],
    format: 'cjs',
    platform: 'node',
    logOverride: {
        'empty-import-meta': 'silent'
    }
}) : Promise.resolve();

// Build configuration for n8nac CLI (Portable version for VS Code)
const n8nacCliEntry = path.join(__dirname, 'node_modules', '@n8n-as-code', 'cli', 'dist', 'index.js');
const fallbackN8nacCliEntry = path.join(__dirname, '..', 'cli', 'dist', 'index.js');
const finalN8nacCliEntry = fs.existsSync(n8nacCliEntry) ? n8nacCliEntry : fallbackN8nacCliEntry;

if (!fs.existsSync(finalN8nacCliEntry)) {
    console.warn('⚠️  n8nac entry point not found, skipping CLI bundle');
}

const n8nacCliBuild = fs.existsSync(finalN8nacCliEntry) ? esbuild.build({
    entryPoints: [finalN8nacCliEntry],
    bundle: true,
    outfile: 'out/cli/index.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    // Force the CJS entry point of prettier so that import.meta.url (which becomes
    // undefined inside a CJS bundle) is never reached.  Without this alias esbuild
    // picks up prettier/index.mjs whose createRequire(import.meta.url) call crashes.
    alias: {
        prettier: 'prettier/index.cjs',
    },
    logOverride: {
        'empty-import-meta': 'silent'
    }
}) : Promise.resolve();

Promise.all([extensionBuild, skillsCliBuild, n8nacCliBuild]).catch(() => process.exit(1));
