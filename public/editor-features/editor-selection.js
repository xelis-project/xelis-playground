import {EditorFeatures} from "./EditorFeatures.js";

EditorFeatures.prototype.auto_surround = function () {
    const ef = this;
    const editor = this.editor;

    const BACKSPACE_KEY = 'Backspace';
    const SHIFT_KEY = 'Shift';

    editor.addEventListener('keydown', (e) => {
        let key = e.key;

        const is_normal_key = !ef.OPEN_CHARS
                .concat(ef.CLOSE_CHARS)
                .concat(ef.QUOTE_CHARS)
                .includes(key)
            && (key !== SHIFT_KEY) && (key !== BACKSPACE_KEY);

        const is_close_bksp_with_no_selection = ef.CLOSE_CHARS.concat(BACKSPACE_KEY).includes(key)
            && !ef.in_empty_surround()
            && ef.sel_start !== ef.sel_end;

        const is_bksp_outside_braces = [BACKSPACE_KEY].includes(key)
            && !ef.in_empty_surround();

        if(is_normal_key || is_close_bksp_with_no_selection || is_bksp_outside_braces) {
            //ef.selected_text = "";
            ef.prev_key = null;
            return;
        }

        e.preventDefault();

        let close_key = "";

        switch(true) {
            case key === SHIFT_KEY:
                return;
            case ef.OPEN_CHARS.includes(key):
                close_key = ef.CLOSE_CHARS[ef.OPEN_CHARS.indexOf(key)];
                break;
            case ef.CLOSE_CHARS.includes(key):
                if (ef.did_ignore_closing_char(ef.OPEN_CHARS, ef.CLOSE_CHARS, key)) {
                    ef.selected_text = "";
                    return;
                }
                break;
            case ef.QUOTE_CHARS.includes(key): //quote
                close_key = key;
                if (ef.did_ignore_closing_char(ef.QUOTE_CHARS, ef.QUOTE_CHARS, key)) {
                    ef.selected_text = "";
                    return;
                }
                break;

            case key === BACKSPACE_KEY:
                const s = editor.value.substring(0, ef.sel_start-1);
                const e = editor.value.substring(ef.sel_start+1);
                editor.value = s + e;

                ef.prev_key = null;
                key = "";
                close_key = "";
                ef.selected_text = "";

                if(ef.sel_start === 1) {
                    editor.selectionStart
                        = editor.selectionEnd
                        = ef.sel_end
                        = ef.sel_start
                        = ef.sel_start = 0;
                    return;
                } else {
                    editor.selectionStart
                        = editor.selectionEnd
                        = ef.sel_end
                        = ef.sel_start
                        = ef.sel_start - 2 < 0 ? 0 : ef.sel_start - 2;
                }

                break;
            default:
                break;
        }

        const editor_pre_text = editor.value.substring(0, ef.sel_start);
        const editor_post_text = editor.value.substring(ef.sel_end);
        editor.value = editor_pre_text + key + ef.selected_text + close_key + editor_post_text;
        editor.selectionStart = ef.sel_start + 1;
        editor.selectionEnd = ef.sel_end + 1;

        ef.prev_key = key;
    });
};


