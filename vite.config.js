import modify from 'rollup-plugin-modify';
import { defineConfig } from 'vite';
import magicalSvg from "vite-plugin-magical-svg";


export default defineConfig(({ command }) => {
    /** @type {import('vite').UserConfig} */
    const config = {
        worker: {
            format: `es`
        },
        server: {
            headers: {
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp"
            }
        },
        build: {
            assetsInlineLimit: Number.MAX_SAFE_INTEGER,
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
        plugins: [
            magicalSvg({
                // By default, the output will be a dom element (the <svg> you can use inside the webpage).
                // You can also change the output to react (or any supported target) to get a component you can use.
                target: 'dom',

                // By default, the svgs are optimized with svgo. You can disable this by setting this to false.
                svgo: false,

                // By default, width and height set on SVGs are not preserved.
                // Set to true to preserve `width` and `height` on the generated SVG.
                preserveWidthHeight: false,

                // *Experimental* - set the width and height on generated SVGs.
                // If used with `preserveWidthHeight`, will only apply to SVGs without a width/height.
                //setWidthHeight: { width: '32', height: '32' },

                // *Experimental* - replace all instances of `fill="..."` and `stroke="..."`.
                // Set to `true` for 'currentColor`, or use a text value to set it to this value.
                // When enabled, use query param ?skip-recolor to not alter colors.
                // Disabled by default.
                setFillStrokeColor: true,

                // *Experimental* - if a SVG comes with `width` and `height` set but no `viewBox`,
                // assume the viewbox is `0 0 {width} {height}` and add it to the SVG.
                // Disabled by default.
                restoreMissingViewBox: true,
            }),
        ],
    }

    if (command === `build`) {
        config.plugins.push(modify({
            find: '../public/xelis_playground.js',
            replace: '/xelis_playground.js'
        }));
    }

    return config;
});
