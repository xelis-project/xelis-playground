import { formatBytes } from 'bytes-formatter';
import type { App } from './app';
import type { Program } from '../public/xelis_playground';

type ExportFormat = 'hex' | 'bytes' | 'json' | 'abi' | 'asm';
const formats: ExportFormat[] = ['hex', 'bytes', 'json', 'abi', 'asm'];
const filenames: Record<ExportFormat, string> = {
    hex: 'xelis_program.txt', bytes: 'xelis_program.bin', json: 'xelis_program.json',
    abi: 'xelis_program.abi.json', asm: 'xelis_program.asm',
};

/** One export pipeline for format selection, preview, downloads, and sharing. */
export class ModalExport {
    readonly element = document.getElementById('modal_export')!;
    private readonly output = document.getElementById('export_program_value')!;
    private readonly size = document.getElementById('export_program_size')!;
    private readonly feedback = document.getElementById('export-feedback')!;
    private blob: Blob | null = null;
    private format: ExportFormat = 'hex';

    constructor(private readonly app: App) {
        document.getElementById('btn_export')!.addEventListener('click', () => {
            const saved = localStorage.getItem('export_tab') as ExportFormat;
            this.select(formats.includes(saved) ? saved : 'hex');
        });
        formats.forEach((format, index) => {
            const tab = document.getElementById(`tab_export_${format}`)!;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', 'export_program_value');
            tab.addEventListener('click', () => this.select(format));
            tab.addEventListener('keydown', event => {
                let next = index;
                if (event.key === 'ArrowRight') next = (index + 1) % formats.length;
                else if (event.key === 'ArrowLeft') next = (index + formats.length - 1) % formats.length;
                else return;
                event.preventDefault();
                this.select(formats[next]);
                document.getElementById(`tab_export_${formats[next]}`)!.focus();
            });
        });
        document.getElementById('btn_export_copy')!.addEventListener('click', () => this.copy(this.output.textContent ?? '', 'Export copied.'));
        document.getElementById('btn_export_share')!.addEventListener('click', () => this.share());
        document.getElementById('btn_export_download')!.addEventListener('click', () => this.download());
    }

    private select(format: ExportFormat) {
        this.format = format;
        localStorage.setItem('export_tab', format);
        this.feedback.textContent = '';
        formats.forEach(value => {
            const tab = document.getElementById(`tab_export_${value}`)!;
            tab.classList.toggle('selected', value === format);
            tab.setAttribute('aria-selected', String(value === format));
            tab.tabIndex = value === format ? 0 : -1;
        });
        let program: Program | undefined;
        try {
            program = this.app.get_program();
            const value = format === 'bytes' ? program!.to_bytes() : format === 'hex' ? program!.to_hex()
                : format === 'json' ? program!.to_json() : format === 'abi' ? program!.to_abi() : program!.to_asm();
            this.output.textContent = typeof value === 'string' ? value : Array.from(value).join(', ');
            this.blob = new Blob([typeof value === 'string' ? value : new Uint8Array(value)], {
                type: format === 'bytes' ? 'application/octet-stream' : 'text/plain',
            });
            this.size.textContent = formatBytes(this.blob.size);
        } catch (error) {
            this.blob = null;
            this.output.textContent = `Unable to export: ${String(error)}`;
            this.size.textContent = '';
        } finally {
            program?.free();
        }
    }

    private async copy(text: string, message: string) {
        try { await navigator.clipboard.writeText(text); this.feedback.textContent = message; }
        catch { this.feedback.textContent = 'Clipboard unavailable. Select and copy the text manually.'; }
    }

    private download() {
        if (!this.blob) return;
        const url = URL.createObjectURL(this.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filenames[this.format];
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    private async share() {
        const url = this.app.get_share_url();
        if (navigator.share) {
            try { await navigator.share({ title: 'XELIS Playground', url }); return; }
            catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; }
        }
        await this.copy(url, 'Share link copied.');
    }
}
