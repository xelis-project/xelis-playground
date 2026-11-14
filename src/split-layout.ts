import Split from 'split.js';

/** Desktop resizing; a naturally scrolling stack on small screens. */
export class SplitLayout {
    private split?: Split.Instance;
    private readonly breakpoint = window.matchMedia('(min-width: 960px)');
    private readonly observer: ResizeObserver;

    constructor(private readonly onResize: () => void) {
        const left = document.getElementById('screen_left')!;
        this.observer = new ResizeObserver(() => this.onResize());
        this.observer.observe(left);
        this.breakpoint.addEventListener('change', this.update);
        this.update();
    }

    private update = () => {
        this.split?.destroy();
        this.split = undefined;
        if (this.breakpoint.matches) {
            this.split = Split(['#screen_left', '#screen_right'], {
                sizes: [64, 36], minSize: [360, 310], gutterSize: 5,
                snapOffset: 0, onDrag: this.onResize,
            });
        }
        this.onResize();
    };

    destroy() {
        this.split?.destroy();
        this.observer.disconnect();
        this.breakpoint.removeEventListener('change', this.update);
    }
}
