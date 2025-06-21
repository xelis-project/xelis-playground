import Split from 'split.js';

export class SplitLayout {
    direction!: 'horizontal' | 'vertical';
    split!: Split.Instance;

    constructor() {
        this.set_split_direction();
        this.set_split();

        window.addEventListener(`resize`, (e) => {
            const changed = this.set_split_direction();
            if (changed) {
                this.split.destroy();
                this.set_split();
            }
        });
    }

    set_split_direction() {
        let temp_direction = this.direction;
        if (window.innerWidth >= 768) {
            this.direction = `horizontal`;
        } else {
            this.direction = `vertical`;
        }

        return temp_direction !== this.direction; // return if changed
    }

    set_split() {
        this.split = Split(
            ['#function_list', '#screen_left', '#screen_right'],
            {
                minSize: 100,
                gutterSize: 6,
                direction: this.direction,
                snapOffset: 0,
            }
        );
    }
}

