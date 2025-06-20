export class TextDotLoading {
    dot_index: number;
    dot_count: number;
    cancel_timeout?: number;
    element: HTMLElement;
    text: string;

    constructor(element: HTMLElement, count: number) {
        this.dot_index = 0;
        this.dot_count = count;
        this.element = element;
        this.text = element.innerText;
    }

    start() {
        const update = () => {
            if (this.dot_index >= this.dot_count) {
                this.element.innerHTML = this.text;
                this.dot_count = 0;
            } else {
                this.element.innerText += ".";
            }

            this.dot_index++;
            this.cancel_timeout = setTimeout(update, 500);
        }

        update();
    }

    stop() {
        clearTimeout(this.cancel_timeout);
        this.element.innerText = this.text;
    }
}
