export class EditorFeatures {
    OPEN_CHARS = '{([';
    CLOSE_CHARS = '})]';
    QUOTE_CHARS = '\'\"\`';
    RETURN_CHAR = 'Enter';

    sel_start = null;
    sel_end = null;
    selected_text = "";

    // need to track last selection point in just in case the user moves
    // to a new selection point with the mouse.
    prev_key = null;
    prev_start = null;
    prev_end = null;

    editor = null;
    features = {
        auto_surround: true,
        auto_indent: true,
    }

    // Dunno why each editor would want it's own keymap,
    // But who says "no" to more flexibility?
    keymap = {
        "Control-/": {
            handler: EditorFeatures._comment
        },

        "Control-?": {
            handler: EditorFeatures._comment
        }
    }

    constructor(editor, features) {
        this.editor = editor;

        const feature = features || false;

        if (features) {
            for (const prop in this.features) {
                if(feature[prop] !== undefined) {
                    this.features[prop] = feature[prop];
                }
            }
        }

        if (this.features.auto_indent) {
            console.log("Auto indent enabled ");
            this.auto_indent();
        }

        this.code_editing();

        if(this.features.auto_surround) {
            // editor-selection.js todo: improve.
            this.auto_surround();
            console.log("Auto surround enabled.");
        } else {
            console.log("Auto surround disabled.");
        }

        this.editor.addEventListener("selectionchange", () => {

            // getSelection broken in Firefox
            this.prev_start = this.sel_start;
            this.prev_end = this.sel_end;

            this.sel_start = this.editor.selectionStart;
            this.sel_end = this.editor.selectionEnd;

            if(this.sel_start !== this.sel_end) {
                this.selected_text = this.editor.value.substring(this.sel_start, this.sel_end);
            } else {
                this.selected_text = "";
            }

        });

        this.editor.editor_features = this;
    }

    static forEditor(editor, features) {
        return new EditorFeatures(editor, features);
    }

    // The closing brace/quote is automatically added.
    // If the user types the closing character, we want to ignore it.
    did_ignore_closing_char(open, close, key) {
        const ef = this;
        const editor = ef.editor;

        if((open.indexOf(ef.prev_key) === close.indexOf(key))
            && [ef.prev_start+1, ef.prev_end+1, ef.sel_start, ef.sel_end].every((val, i, arr) => val === arr[0])
            && ef.selected_text === "") {
            editor.selectionStart = ef.sel_start + 1;
            editor.selectionEnd = ef.sel_end + 1;
            ef.prev_start = ef.prev_end = ef.sel_start = ef.sel_end = null;
            return true;
        }
        return false;
    }

    in_empty_surround() {
        const ef = this;
        const editor = ef.editor;

        const s = editor.selectionStart;
        const e = editor.selectionEnd;

        if (s === 0 || s !== e) {
            return false;
        }

        let surrounds = [];

        for (let i = 0; i < ef.OPEN_CHARS.length; ++i) {
            surrounds.push(ef.OPEN_CHARS[i].concat(ef.CLOSE_CHARS[i]));
        }
        for (let i = 0; i < ef.QUOTE_CHARS.length; ++i) {
            surrounds.push(ef.QUOTE_CHARS[i].concat(ef.QUOTE_CHARS[i]));
        }

        const two_chars = editor.value.substring(s - 1);
        for (let i = 0; i < surrounds.length; ++i) {
            if(two_chars.startsWith(surrounds[i])) {
                ef.prev_key = surrounds[i][0];
                return true;
            }
        }

        ef.prev_key = null;

        return false;
    }

    auto_surround() {
        // implementation in editor-selection.js;
        // if we are in here, well...
        console.log("Editor auto_surround implementation missing.");
    }

    auto_indent() {
        const editor_features = this;
        const editor = this.editor;

        // Count the number of tabs on current line.
        // if last char before return is "{,(,[" or whitespace (trim), add extra return and tab
        // otherwise indent to current tab count.
        editor.addEventListener('keydown', (e) => {
            let key = e.key;

            if(key !== editor_features.RETURN_CHAR) {
                return false;
            }

            //editor_features.set_selection();

            const editor_pre_text = editor.value.substring(0, editor_features.sel_start);
            const editor_post_text = editor.value.substring(editor_features.sel_end);

            const pre_lines = editor_pre_text.split('\n');

            if (pre_lines.length === 0) {
                return false;
            }

            let last_line = pre_lines[pre_lines.length - 1].trimEnd();
            // if the line contains whitespace only, keep it without trimming.
            last_line = last_line.length === 0 ? pre_lines[pre_lines.length - 1] : last_line;

            const tab_re = new RegExp(/^\t+/, "i")
            const tab_at_start = last_line.match(tab_re);

            const has_open_char = editor_features.OPEN_CHARS.split('').includes(last_line.charAt(last_line.length - 1));
            const has_tabs = tab_at_start !== null && tab_at_start !== undefined;

            if(!(has_tabs || has_open_char) ) {
                return false;
            }

            e.preventDefault();

            let tabs = (has_tabs ? tab_at_start[0] : "" ) + (has_open_char ? '\t' : '');

            const pre_last_char = last_line.charAt(last_line.length - 1); //editor_features.CLOSE_CHARS.split('').includes();
            const post_lines = editor_post_text.split('\n');
            const post_first_char = post_lines.length > 0 ? post_lines[0].trimStart().charAt(0) : '';
            const is_same_closed_char = (pre_last_char === post_first_char) && editor_features.CLOSE_CHARS.split('').includes(post_first_char);

            let reformatting = `\n${tabs}`;

            if(editor_features.in_empty_surround()) {
                reformatting = `\n${tabs}\n${tabs.substring(0, tabs.length-1)}`;
            } else if (is_same_closed_char) {
                reformatting = `\n${tabs.substring(0, tabs.length-1)}`;
            }

            editor.value = editor_pre_text + reformatting + editor_post_text;
            editor.selectionStart = editor_features.sel_start + tabs.length + 1;
            editor.selectionEnd = editor_features.sel_end + tabs.length + 1;

            editor_features.prev_key = key;
        });
    }

    code_editing() {
        const ef = this;
        const editor = this.editor;
        //const edit_keys = '/<>?';

        let ctrl_pressed = false;

        editor.addEventListener('keydown', (e) => {
            let key = e.key;

            if(key === 'Control') {
                ctrl_pressed = true;
                return;
            }

            if(ctrl_pressed) {

                if(!"\?\/".includes(key)) {
                    return;
                }

                const cmd = this.keymap[`Control-${key}`];

                e.preventDefault();
                if (cmd !== undefined && cmd !== null) {
                    cmd.handler(ef);
                }
            }
        });

        editor.addEventListener('keyup', (e) => {
            let key = e.key;

            if(key === 'Control') {
                ctrl_pressed = false;
            }
        });
    }

    static _comment(editor_features) {
        editor_features.comment();
    }

    comment() {
        // implementation comment.js
        // if we are in here, well...
        console.log("Editor commenting implementation missing.");
    }
}
