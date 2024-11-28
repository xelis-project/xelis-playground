import 'https://cdnjs.cloudflare.com/ajax/libs/split.js/1.6.5/split.min.js';

// the split layout on small screen (mobile) won't drag because we need a min-height
// and if we set this height the textarea highlighted code vertical scrollbar bugs

let direction;
let split;

function set_split_direction() {
    let temp_direction = direction;
    if (window.innerWidth >= 768) {
        direction = `horizontal`;
    } else {
        direction = `vertical`;
    }

    return temp_direction !== direction; // if changed
}

set_split_direction();

function set_split() {
    split = Split(
        ['#screen_left', '#screen_right'],
        {
            minSize: 300,
            gutterSize: 6,
            direction: direction,
        }
    );
}

set_split();

window.addEventListener(`resize`, (e) => {
  const changed = set_split_direction();
  if (changed) {
      split.destroy();
      set_split();
  }
});
