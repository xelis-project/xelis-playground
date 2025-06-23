/** @type {import('vite').UserConfig} */
export default {
    server: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp"
        }
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: (id) =>{
                    if (id.includes("node_modules")) {
                        return 'vendor';
                    }

                    return null;
                }
            }
        }
    }
}