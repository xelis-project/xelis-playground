import Split from 'split.js';
import { App } from './app';

export class SplitLayout {
    direction: 'horizontal' | 'vertical';
    split?: Split.Instance;

    app: App;
    left_screen: HTMLElement;
    right_screen: HTMLElement;

    constructor(app: App) {
        this.app = app;

        this.direction = this.calc_direction();
        this.left_screen = document.getElementById(`screen_left`) as HTMLElement;
        this.right_screen = document.getElementById(`screen_right`) as HTMLElement;
        this.update_split();

        window.addEventListener(`resize`, (e) => this.handle_resize());
    }

    handle_resize() {
        const direction = this.calc_direction();
        if (this.direction !== direction) {
            this.direction = direction;
            this.update_split();
        }
    }

    calc_direction() {
        if (window.innerWidth >= 768) {
            return `horizontal`;
        } else {
            return `vertical`;
        }
    }

    update_split() {
        let elements = [this.left_screen, this.right_screen];
        if (this.app.func_list.is_opened) {
            elements.unshift(this.app.func_list.element);
        }

        if (this.split) this.split.destroy();
        this.split = Split(
            elements,
            {
                minSize: 100,
                gutterSize: 6,
                direction: this.direction,
                snapOffset: 0,
            }
        );
    }
}

