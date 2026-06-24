export class Utils {
    static convertSvgElementToHtml(svgElement: SVGSVGElement): string {
        const serializer = new XMLSerializer();
        return serializer.serializeToString(svgElement);
    }

    static encodeBase64Url(text: string): string {
        const bytes = new TextEncoder().encode(text);
        const chunk_size = 0x8000;
        let binary = "";

        for (let i = 0; i < bytes.length; i += chunk_size) {
            binary += String.fromCharCode(...Array.from(bytes.slice(i, i + chunk_size)));
        }

        return btoa(binary)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");
    }

    static decodeBase64Url(encoded_text: string): string {
        const normalized = encoded_text
            .trim()
            .replace(/ /g, "+")
            .replace(/-/g, "+")
            .replace(/_/g, "/");
        const padding_length = (4 - (normalized.length % 4)) % 4;
        const padded = normalized + "=".repeat(padding_length);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return new TextDecoder().decode(bytes);
    }
}
