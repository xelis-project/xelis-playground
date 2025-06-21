import Split from 'split.js';

//import 'https://cdnjs.cloudflare.com/ajax/libs/split.js/1.6.5/split.min.js';

// the split layout on small screen (mobile) won't drag because we need a min-height
// and if we set this height the textarea highlighted code vertical scrollbar bugs

export class SplitLayout {
    direction: 'horizontal' | 'vertical';
    split: Split.Instance;

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
            ['#screen_left', '#screen_right'],
            {
                minSize: 100,
                gutterSize: 6,
                direction: this.direction,
                snapOffset: 0,
            }
        );
    }
}

