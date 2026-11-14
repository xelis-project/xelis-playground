/** A stoppable progress indicator that never restores stale output twice. */
export class TextDotLoading {
    private timer?: number;
    private original = '';

    constructor(private readonly element: HTMLElement, private readonly count = 3) {}

    start() {
        this.stop();
        this.original = this.element.textContent ?? '';
        let dots = 0;
        this.timer = window.setInterval(() => {
            dots = (dots + 1) % (this.count + 1);
            this.element.textContent = this.original + '.'.repeat(dots);
        }, 500);
    }

    stop() {
        if (this.timer === undefined) return;
        window.clearInterval(this.timer);
        this.timer = undefined;
        this.element.textContent = this.original;
    }
}
