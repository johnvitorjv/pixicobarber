import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
export function versionServiceWorker() {
    let root;
    return {
        name: 'pixico-version-service-worker', apply: 'build',
        configResolved(config) { root = config.root; },
        async writeBundle(output, bundle) {
            const template = await readFile(resolve(root, 'public/sw.js'), 'utf8');
            const hash = createHash('sha256').update(template).update(Object.keys(bundle).sort().join('|'));
            for (const file of ['offline.html','offline.css','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png']) hash.update(await readFile(resolve(root,'public',file)));
            const version = hash.digest('hex').slice(0,16);
            await writeFile(resolve(root, output.dir || 'dist', 'sw.js'), template.replace(/const CACHE_NAME = '[^']+';/, () => "const CACHE_NAME = 'pixico-static-" + version + "';"));
        },
    };
}
