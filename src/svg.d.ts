// declare module '*.svg?react' {
//     import { FunctionComponent, SVGProps } from 'react'; // Even without React, this type declaration is often used for SVGR
//     const content: FunctionComponent<SVGProps<SVGSVGElement>>;
//     export default content;
// }

declare module '*.svg' {
    const content: SVGSVGElement;
    export default content;
}

declare module '*.svg?sprite=inline' {
    const content: SVGSVGElement;
    export default content;
}