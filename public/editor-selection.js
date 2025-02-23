const OPEN_CHARS = '{([';
const CLOSE_CHARS = '})]';
const QUOTE_CHARS = '\'\"\`';

let sel_start = null;
let sel_end = null;
let selected_text = "";

// need to track last selection point in just in case the user moves
// to a new selection point with the mouse.
let prev_key = null;
let prev_start = null;
let prev_end = null;

input_editor.addEventListener("selectionchange", (e) => {
    // getSelection broken in Firefox
    prev_start = sel_start;
    prev_end = sel_end;

    sel_start = input_editor.selectionStart;
    sel_end = input_editor.selectionEnd;

    if(sel_start !== sel_end) {
        selected_text = input_editor.value.substring(sel_start, sel_end);
    } else {
        selected_text = "";
    }
});

// The closing brace/quote is automatically added.
// If the user types the closing character, we want to ignore it.
function did_ignore_closing_char(open, close, key) {
    if((open.indexOf(prev_key) === close.indexOf(key))
        && [prev_start+1, prev_end+1, sel_start, sel_end].every((val, i, arr) => val === arr[0])
        && selected_text === "") {
        input_editor.selectionStart = sel_start + 1;
        input_editor.selectionEnd = sel_end + 1;
        prev_start = prev_end = sel_start = sel_end = null;
        return true;
    }
    return false;
}

function in_empty_surround() {
    const s = input_editor.selectionStart;
    const e = input_editor.selectionEnd;

    if (s === 0 || s !== e) {
        return false;
    }

    let surrounds = [];

    for (let i = 0; i < OPEN_CHARS.length; ++i) {
        surrounds.push(OPEN_CHARS[i].concat(CLOSE_CHARS[i]));
    }
    for (let i = 0; i < QUOTE_CHARS.length; ++i) {
        surrounds.push(QUOTE_CHARS[i].concat(QUOTE_CHARS[i]));
    }

    const two_chars = input_editor.value.substring(s - 1);
    for (let i = 0; i < surrounds.length; ++i) {
        if(two_chars.startsWith(surrounds[i])) {
            prev_key = surrounds[i][0];
            return true;
        }
    }

    prev_key = null;

    return false;
}

input_editor.addEventListener('keydown', (e) => {
    let key = e.key;

    const is_normal_key = !OPEN_CHARS
            .concat(CLOSE_CHARS)
            .concat(QUOTE_CHARS)
            .includes(key)
        && (key !== 'Shift') && (key !== 'Backspace');

    const is_close_bksp_with_no_selection = CLOSE_CHARS.concat('Backspace').includes(key)
        && !in_empty_surround()
        && sel_start !== sel_end;

    const is_bksp_outside_braces = ['Backspace'].includes(key)
        && !in_empty_surround();

    if(is_normal_key || is_close_bksp_with_no_selection || is_bksp_outside_braces) {
        selected_text = "";
        prev_key = null;
        return;
    }

    e.preventDefault();

    let close_key = "";

    switch(true) {
        case key === "Shift":
            return;
        case OPEN_CHARS.includes(key):
            close_key = CLOSE_CHARS[OPEN_CHARS.indexOf(key)];
            break;
        case CLOSE_CHARS.includes(key):
            if (did_ignore_closing_char(OPEN_CHARS, CLOSE_CHARS, key)) {
                selected_text = "";
                return;
            }
            break;
        case QUOTE_CHARS.includes(key): //quote
            close_key = key;
            if (did_ignore_closing_char(QUOTE_CHARS, QUOTE_CHARS, key)) {4
                selected_text = "";
                return;
            }
            break;

        case key === 'Backspace':
            const s = input_editor.value.substring(0, sel_start-1);
            const e = input_editor.value.substring(sel_start+1);
            input_editor.value = s + e;

            prev_key = null;
            key = "";
            close_key = "";
            selected_text = "";

            if(sel_start === 1) {
                input_editor.selectionStart
                    = input_editor.selectionEnd
                    = sel_end
                    = sel_start
                    = sel_start = 0;
                return;
            } else {
                input_editor.selectionStart
                    = input_editor.selectionEnd
                    = sel_end
                    = sel_start
                    = sel_start - 2 < 0 ? 0 : sel_start - 2;
            }

            break;
        default:
            break;
    }

    const editor_pre_text = input_editor.value.substring(0, sel_start);
    const editor_post_text = input_editor.value.substring(sel_end);
    input_editor.value = editor_pre_text + key + selected_text + close_key + editor_post_text;
    input_editor.selectionStart = sel_start + 1;
    input_editor.selectionEnd = sel_end + 1;

    prev_key = key;
});
