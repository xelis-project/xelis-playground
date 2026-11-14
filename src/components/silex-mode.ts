import ace from 'ace-builds';
import 'ace-builds/src-noconflict/mode-rust';

const TextHighlightRules = ace.require('ace/mode/text_highlight_rules').TextHighlightRules;
const RustMode = ace.require('ace/mode/rust').Mode;

/** Silex tokens use Dark+ categories while retaining Rust-style editing/folding. */
interface SilexHighlightRules extends ace.Ace.HighlightRules {}

class SilexHighlightRules extends TextHighlightRules {
    constructor() {
        super();
        this.$rules = {
            start: [
                { token: 'comment.line', regex: '//.*$' },
                { token: 'comment.start', regex: '/\\*', push: 'comment' },
                { token: 'string.start', regex: '"', push: 'string' },
                { token: 'keyword.control', regex: '\\b(?:if|else|match|for|while|loop|break|continue|return|assert|panic)\\b' },
                { token: 'storage.type', regex: '\\b(?:entry|fn|let|const|struct|enum|impl|event|type|pub|mut|as|in|import|use)\\b' },
                { token: 'constant.language', regex: '\\b(?:true|false|null|None|Some)\\b' },
                { token: 'support.type', regex: '\\b(?:u8|u16|u32|u64|u128|u256|bool|string|bytes|optional|map|range|any|void)\\b' },
                { token: 'constant.numeric', regex: '\\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|[0-9][0-9_]*)(?:u(?:8|16|32|64|128|256))?\\b' },
                { token: 'entity.name.function', regex: '\\b[a-zA-Z_]\\w*(?=\\s*(?:<[^;{}()]*>)?\\s*\\()' },
                { token: 'entity.name.type', regex: '\\b[A-Z][a-zA-Z0-9_]*\\b' },
                { token: 'variable.language', regex: '\\bself\\b' },
                { token: 'variable', regex: '[a-zA-Z_]\\w*' },
                { token: 'keyword.operator', regex: '::|->|=>|[+*/%=!<>&|^~?:-]+' },
                { token: 'paren', regex: '[{}()\\[\\]]' },
                { token: 'punctuation.operator', regex: '[.,;]' },
                { token: 'text', regex: '\\s+' },
            ],
            comment: [
                { token: 'comment.start', regex: '/\\*', push: 'comment' },
                { token: 'comment.end', regex: '\\*/', next: 'pop' },
                { defaultToken: 'comment' },
            ],
            string: [
                { token: 'constant.character.escape', regex: '\\\\(?:u\\{[0-9a-fA-F]+\\}|x[0-9a-fA-F]{2}|.)' },
                { token: 'string.end', regex: '"', next: 'pop' },
                { defaultToken: 'string' },
            ],
        };
        this.normalizeRules();
    }
}

export interface SilexMode extends ace.Ace.SyntaxMode {}

export class SilexMode extends RustMode {
    constructor() {
        super();
        this.HighlightRules = SilexHighlightRules;
        this.$id = 'ace/mode/silex';
    }
}
