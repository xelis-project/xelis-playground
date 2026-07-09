import { Parameter } from "../xvm_param_parser";

export function bytes_type(parameter: Parameter, root_container: HTMLElement) {

    const input_container = document.createElement('div');
    input_container.classList.add('input-container', 'type-container', 'bytes-type');
    input_container.setAttribute("data-type", parameter.type);

    const input = document.createElement('textarea');
    input.placeholder = "BYTES: Hex data only";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");

    const bytes_tag = document.createElement(parameter.type.toLowerCase());
    const content = document.createElement("content");
    content.textContent = input.value;
    bytes_tag.appendChild(content);

    function verifyHexLength() {
        // disable "done" button if bytes length is odd
        const btn_close_arg_editor = document.querySelector("#btn_close_arg_editor") as HTMLButtonElement;
        if (input.value.length % 2 !== 0) {
            btn_close_arg_editor.setAttribute("disabled", "true");
            input.classList.add("invalid-data");
        } else {
            btn_close_arg_editor.removeAttribute("disabled");
            input.classList.remove("invalid-data");
        }

        content.textContent = input.value;
    }

    function isHexOnly(text: string): boolean {
        return /^[A-Fa-f0-9]+$/.test(text);
    }

    input.addEventListener("change", () => {
        content.textContent = input.value;

        verifyHexLength();

        const pbi_did_change_event = new CustomEvent("pb-input-did-change", {
            detail: {
                text: content.textContent,
            },
        });
        document.dispatchEvent(pbi_did_change_event);
    });

    input.addEventListener('keydown', (e) => {
        let key = e.key;

        if (key === 'Enter') {
            e.preventDefault();
            return false;
        }

        let isAllowedControlKey = false;

        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z (Undo), Ctrl+Y (Redo)
        if ((e.ctrlKey || e.metaKey) &&
            ['a', 'c', 'v', 'x', 'z', 'y'].includes(e.key.toLowerCase())) {
            return;
        }

        switch (key) {
            case 'Backspace':
            case 'Delete':
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight':
                isAllowedControlKey = true;
                break;

        }

        if (isAllowedControlKey) {
            return;
        }

        if (!isHexOnly(key)) {
            e.preventDefault();
            return false;
        }

    });

    input.addEventListener('keyup', () => {
        verifyHexLength();
    });

    input.addEventListener('paste', (e) => {
        const paste = (e.clipboardData as DataTransfer).getData('text') || '';
        if (!isHexOnly(paste)) {
            e.preventDefault();
            return false;
        }
    });


    input_container.appendChild(input);

    root_container.appendChild(input_container);

    return bytes_tag;
}
