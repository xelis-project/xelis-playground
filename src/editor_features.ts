interface EditorOptions {
    auto_surround: boolean;
    auto_indent: boolean;
}

export class EditorFeatures {
    OPEN_CHARS = '{([';
    CLOSE_CHARS = '})]';
    QUOTE_CHARS = '\'\"\`';
    RETURN_CHAR = 'Enter';

    sel_start: number;
    sel_end: number;
    selected_text = "";

    // need to track last selection point in just in case the user moves
    // to a new selection point with the mouse.
    prev_key: string | null;
    prev_start: number;
    prev_end: number;

    editor: HTMLInputElement;
    options: EditorOptions;

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

    constructor(editor: HTMLInputElement, options: EditorOptions) {
        this.editor = editor;
        this.options = options;

        if (this.options.auto_indent) {
            console.log("Auto indent enabled ");
            this.auto_indent();
        }

        this.code_editing();

        if (this.options.auto_surround) {
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

            this.sel_start = this.editor.selectionStart || 0;
            this.sel_end = this.editor.selectionEnd || 0;

            if (this.sel_start !== this.sel_end) {
                this.selected_text = this.editor.value.substring(this.sel_start, this.sel_end);
            } else {
                this.selected_text = "";
            }

        });

        // this.this.editor.editor_features = this;
    }

    // The closing brace/quote is automatically added.
    // If the user types the closing character, we want to ignore it.
    did_ignore_closing_char(open, close, key) {
        if ((open.indexOf(this.prev_key) === close.indexOf(key))
            && [this.prev_start + 1, this.prev_end + 1, this.sel_start, this.sel_end].every((val, i, arr) => val === arr[0])
            && this.selected_text === "") {
            this.editor.selectionStart = this.sel_start + 1;
            this.editor.selectionEnd = this.sel_end + 1;
            this.prev_start = this.prev_end = this.sel_start = this.sel_end = 0;
            return true;
        }
        return false;
    }

    in_empty_surround() {
        const s = this.editor.selectionStart || 0;
        const e = this.editor.selectionEnd || 0;

        if (s === 0 || s !== e) {
            return false;
        }

        let surrounds = [] as string[];

        for (let i = 0; i < this.OPEN_CHARS.length; ++i) {
            surrounds.push(this.OPEN_CHARS[i].concat(this.CLOSE_CHARS[i]));
        }
        for (let i = 0; i < this.QUOTE_CHARS.length; ++i) {
            surrounds.push(this.QUOTE_CHARS[i].concat(this.QUOTE_CHARS[i]));
        }

        const two_chars = this.editor.value.substring(s - 1);
        for (let i = 0; i < surrounds.length; ++i) {
            if (two_chars.startsWith(surrounds[i])) {
                this.prev_key = surrounds[i][0];
                return true;
            }
        }

        this.prev_key = null;

        return false;
    }

    auto_surround() {
        const BACKSPACE_KEY = 'Backspace';
        const SHIFT_KEY = 'Shift';

        this.editor.addEventListener('keydown', (e) => {
            let key = e.key;

            const is_normal_key = !this.OPEN_CHARS
                .concat(this.CLOSE_CHARS)
                .concat(this.QUOTE_CHARS)
                .includes(key)
                && (key !== SHIFT_KEY) && (key !== BACKSPACE_KEY);

            const is_close_bksp_with_no_selection = this.CLOSE_CHARS.concat(BACKSPACE_KEY).includes(key)
                && !this.in_empty_surround()
                && this.sel_start !== this.sel_end;

            const is_bksp_outside_braces = [BACKSPACE_KEY].includes(key)
                && !this.in_empty_surround();

            if (is_normal_key || is_close_bksp_with_no_selection || is_bksp_outside_braces) {
                //this.selected_text = "";
                this.prev_key = null;
                return;
            }

            e.preventDefault();

            let close_key = "";

            switch (true) {
                case key === SHIFT_KEY:
                    return;
                case this.OPEN_CHARS.includes(key):
                    close_key = this.CLOSE_CHARS[this.OPEN_CHARS.indexOf(key)];
                    break;
                case this.CLOSE_CHARS.includes(key):
                    if (this.did_ignore_closing_char(this.OPEN_CHARS, this.CLOSE_CHARS, key)) {
                        this.selected_text = "";
                        return;
                    }
                    break;
                case this.QUOTE_CHARS.includes(key): //quote
                    close_key = key;
                    if (this.did_ignore_closing_char(this.QUOTE_CHARS, this.QUOTE_CHARS, key)) {
                        this.selected_text = "";
                        return;
                    }
                    break;

                case key === BACKSPACE_KEY:
                    const s = this.editor.value.substring(0, this.sel_start - 1);
                    const e = this.editor.value.substring(this.sel_start + 1);
                    this.editor.value = s + e;

                    this.prev_key = null;
                    key = "";
                    close_key = "";
                    this.selected_text = "";

                    if (this.sel_start === 1) {
                        this.editor.selectionStart
                            = this.editor.selectionEnd
                            = this.sel_end
                            = this.sel_start
                            = this.sel_start = 0;
                        return;
                    } else {
                        this.editor.selectionStart
                            = this.editor.selectionEnd
                            = this.sel_end
                            = this.sel_start
                            = this.sel_start - 2 < 0 ? 0 : this.sel_start - 2;
                    }

                    break;
                default:
                    break;
            }

            const editor_pre_text = this.editor.value.substring(0, this.sel_start);
            const editor_post_text = this.editor.value.substring(this.sel_end);
            this.editor.value = editor_pre_text + key + this.selected_text + close_key + editor_post_text;
            this.editor.selectionStart = this.sel_start + 1;
            this.editor.selectionEnd = this.sel_end + 1;

            this.prev_key = key;
        });
    }

    auto_indent() {
        // Count the number of tabs on current line.
        // if last char before return is "{,(,[" or whitespace (trim), add extra return and tab
        // otherwise indent to current tab count.
        this.editor.addEventListener('keydown', (e) => {
            let key = e.key;

            if (key !== this.RETURN_CHAR) {
                return false;
            }

            //editor_features.set_selection();

            const editor_pre_text = this.editor.value.substring(0, this.sel_start);
            const editor_post_text = this.editor.value.substring(this.sel_end);

            const pre_lines = editor_pre_text.split('\n');

            if (pre_lines.length === 0) {
                return false;
            }

            let last_line = pre_lines[pre_lines.length - 1].trimEnd();
            // if the line contains whitespace only, keep it without trimming.
            last_line = last_line.length === 0 ? pre_lines[pre_lines.length - 1] : last_line;

            const tab_re = new RegExp(/^\t+/, "i")
            const tab_at_start = last_line.match(tab_re);

            const has_open_char = this.OPEN_CHARS.split('').includes(last_line.charAt(last_line.length - 1));
            const has_tabs = tab_at_start !== null && tab_at_start !== undefined;

            if (!(has_tabs || has_open_char)) {
                return false;
            }

            e.preventDefault();

            let tabs = (has_tabs ? tab_at_start[0] : "") + (has_open_char ? '\t' : '');

            const pre_last_char = last_line.charAt(last_line.length - 1); //editor_features.CLOSE_CHARS.split('').includes();
            const post_lines = editor_post_text.split('\n');
            const post_first_char = post_lines.length > 0 ? post_lines[0].trimStart().charAt(0) : '';
            const is_same_closed_char = (pre_last_char === post_first_char) && this.CLOSE_CHARS.split('').includes(post_first_char);

            let reformatting = `\n${tabs}`;

            if (this.in_empty_surround()) {
                reformatting = `\n${tabs}\n${tabs.substring(0, tabs.length - 1)}`;
            } else if (is_same_closed_char) {
                reformatting = `\n${tabs.substring(0, tabs.length - 1)}`;
            }

            this.editor.value = editor_pre_text + reformatting + editor_post_text;
            this.editor.selectionStart = this.sel_start + tabs.length + 1;
            this.editor.selectionEnd = this.sel_end + tabs.length + 1;

            this.prev_key = key;
        });
    }

    code_editing() {
        const ef = this;
        const editor = this.editor;
        //const edit_keys = '/<>?';

        let ctrl_pressed = false;

        this.editor.addEventListener('keydown', (e) => {
            let key = e.key;

            if (key === 'Control') {
                ctrl_pressed = true;
                return;
            }

            if (ctrl_pressed) {

                if (!"\?\/".includes(key)) {
                    return;
                }

                const cmd = this.keymap[`Control-${key}`];

                e.preventDefault();
                if (cmd !== undefined && cmd !== null) {
                    cmd.handler(ef);
                }
            }
        });

        this.editor.addEventListener('keyup', (e) => {
            let key = e.key;

            if (key === 'Control') {
                ctrl_pressed = false;
            }
        });
    }

    static _comment(editor_features: EditorFeatures) {
        editor_features.comment();
    }

    uncomment_regexp = /^([\ ?\t?]+)?\/\/\ ?(.+)?/g;
    comment_regexp = /^([\ ?\t?]+)?(.+)?/g;

    comment() {
        let editor_pre_text = this.editor.value.substring(0, this.sel_start);
        let editor_post_text = this.editor.value.substring(this.sel_end);

        let lines_before_cursor = editor_pre_text.split('\n');
        let lines_after_cursor = editor_post_text.split('\n');
        let selected_lines = this.selected_text.split('\n');

        if (lines_before_cursor.length === 0) {
            return false;
        }

        let last_pre_line_text = lines_before_cursor[lines_before_cursor.length - 1];
        let first_post_line_text = lines_after_cursor.length > 0 ? lines_after_cursor[0] : "";

        let should_comment = true;
        let left = last_pre_line_text;
        let right = selected_lines.length === 1 ? first_post_line_text : "";
        let merged_line = left + selected_lines[0] + right;

        if (merged_line.trim().length === 0) {
            return false;
        }

        if (merged_line.trim().startsWith("//")) {
            should_comment = false;
        }

        for (let i = 0; i < selected_lines.length; i++) {

            left = i === 0 ? last_pre_line_text : "";
            right = i === selected_lines.length - 1 ? first_post_line_text : "";
            merged_line = left + selected_lines[i] + right;

            if (should_comment) {
                selected_lines[i] = merged_line.replaceAll(this.comment_regexp, "$1// $2");
            } else {
                selected_lines[i] = merged_line.replaceAll(this.uncomment_regexp, "$1$2");
            }
        }

        lines_before_cursor[lines_before_cursor.length - 1] = '';
        lines_after_cursor[0] = '';

        editor_pre_text = lines_before_cursor.join('\n');
        editor_post_text = lines_after_cursor.join('\n');
        const editor_selected_text = selected_lines.join('\n');

        this.editor.value = editor_pre_text + editor_selected_text + editor_post_text;

        this.editor.selectionStart = editor_pre_text.length + editor_selected_text.length;
        this.editor.selectionEnd = editor_pre_text.length + editor_selected_text.length;;
    }
}
