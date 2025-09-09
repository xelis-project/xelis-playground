export class Utils {
    static convertSvgElementToHtml(svgElement: SVGSVGElement): string {
        const serializer = new XMLSerializer();
        return serializer.serializeToString(svgElement);
    }
}