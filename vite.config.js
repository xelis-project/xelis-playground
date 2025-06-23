import modify from 'rollup-plugin-modify';
import { defineConfig } from 'vite';

/** @type {import('vite').UserConfig} */
export default defineConfig(({ command }) => {
    const config = {
        server: {
            headers: {
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp"
            }
        },
        build: {
            rollupOptions: {
                external: ['../public/xelis_playground.js', '/xelis_playground.js'], // this has to be external (untouched) - can't run silex if it's bundled / in production
                output: {
                    manualChunks: (path) => {
                        if (path.includes("node_modules")) {
                            return 'vendor';
                        }

                        return null;
                    }
                }
            }
        },
        plugins: []
    }

    if (command === `build`) {
        config.plugins.push(modify({
            find: '../public/xelis_playground.js',
            replace: '/xelis_playground.js'
        }));
    }

    return config;
});
