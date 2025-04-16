import {EditorFeatures} from "./EditorFeatures.js";

EditorFeatures.uncomment_regexp = /^([\ ?\t?]+)?\/\/\ ?(.+)?/g;
EditorFeatures.comment_regexp = /^([\ ?\t?]+)?(.+)?/g;

EditorFeatures.prototype.comment = function () {
    const ef = this;
    const editor = ef.editor;

    let editor_pre_text = editor.value.substring(0, ef.sel_start);
    let editor_post_text = editor.value.substring(ef.sel_end);

    let lines_before_cursor = editor_pre_text.split('\n');
    let lines_after_cursor = editor_post_text.split('\n');
    let selected_lines = ef.selected_text.split('\n');

    if (lines_before_cursor.length === 0) {
        return false;
    }

    let last_pre_line_text = lines_before_cursor[lines_before_cursor.length - 1];
    let first_post_line_text = lines_after_cursor.length > 0 ? lines_after_cursor[0] : "";

    let should_comment = true;
    let left = last_pre_line_text;
    let right = selected_lines.length === 1 ? first_post_line_text : "";
    let merged_line = left + selected_lines[0] + right;

    if(merged_line.trim().length === 0) {
        return false;
    }

    if(merged_line.trim().startsWith("//")) {
        should_comment = false;
    }

    for (let i = 0; i < selected_lines.length; i++) {

        left = i === 0 ? last_pre_line_text : "";
        right = i === selected_lines.length - 1 ? first_post_line_text : "";
        merged_line = left + selected_lines[i] + right;

        if(should_comment) {
            selected_lines[i] = merged_line.replaceAll(EditorFeatures.comment_regexp, "$1// $2");
        } else {
            selected_lines[i] = merged_line.replaceAll(EditorFeatures.uncomment_regexp, "$1$2");
        }
    }

    lines_before_cursor[lines_before_cursor.length - 1] = '';
    lines_after_cursor[0] = '';

    editor_pre_text = lines_before_cursor.join('\n');
    editor_post_text = lines_after_cursor.join('\n');
    const editor_selected_text = selected_lines.join('\n');

    editor.value = editor_pre_text + editor_selected_text + editor_post_text;

    editor.selectionStart = editor_pre_text.length + editor_selected_text.length;
    editor.selectionEnd = editor_pre_text.length + editor_selected_text.length;;

};