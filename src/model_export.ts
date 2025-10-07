import { formatBytes } from 'bytes-formatter';
import { App } from './app';

export class ModalExport {
  app: App;

  element: HTMLElement;
  btn_export_download: HTMLElement;
  btn_export_copy: HTMLElement;
  tab_export_hex: HTMLElement;
  tab_export_bytes: HTMLElement;
  tab_export_json: HTMLElement;
  tab_export_abi: HTMLElement;
  export_program_value: HTMLElement;
  btn_export: HTMLElement;
  export_program_size: HTMLElement;

  program_blob: Blob | null = null;
  program_filename: string | null = null;

  constructor(app: App) {
    this.app = app;

    this.element = document.getElementById('modal_export') as HTMLElement;
    this.btn_export_download = document.getElementById('btn_export_download') as HTMLElement;
    this.btn_export_copy = document.getElementById('btn_export_copy') as HTMLElement;
    this.tab_export_hex = document.getElementById('tab_export_hex') as HTMLElement;
    this.tab_export_bytes = document.getElementById('tab_export_bytes') as HTMLElement;
    this.tab_export_json = document.getElementById('tab_export_json') as HTMLElement;
    this.tab_export_abi = document.getElementById('tab_export_abi') as HTMLElement;
    this.export_program_value = document.getElementById('export_program_value') as HTMLElement;
    this.btn_export = document.getElementById('btn_export') as HTMLElement;
    this.export_program_size = document.getElementById('export_program_size') as HTMLElement;

    this.btn_export.addEventListener("click", () => this.handle_export_click());
    this.tab_export_hex.addEventListener('click', () => this.handle_tab_click('hex'));
    this.tab_export_bytes.addEventListener('click', () => this.handle_tab_click('bytes'));
    this.tab_export_json.addEventListener('click', () => this.handle_tab_click('json'));
    this.tab_export_abi.addEventListener('click', () => this.handle_tab_click('abi'));
    this.btn_export_copy.addEventListener('click', () => this.handle_copy_click());
    this.btn_export_download.addEventListener('click', () => this.handle_download_click());
  }

  handle_export_click() {
    //open_modal(this.modal_export);

    const export_type = localStorage.getItem("export_tab") || "hex";
    this.set_export_type(export_type);
  }

  handle_tab_click(type: string) {
    localStorage.setItem("export_tab", type);
    this.set_export_type(type);
  }

  handle_copy_click() {
    const program_value = this.export_program_value.innerText;
    navigator.clipboard.writeText(program_value);
    alert('Program copied to clipboard.');
  }

  handle_download_click() {
    if (this.program_blob) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(this.program_blob);
      a.download = this.program_filename || '';
      a.click();
    }
  }

  set_export_type(type: string) {
    switch (type) {
      case "hex":
        this.set_export_hex();
        break;
      case "bytes":
        this.set_export_bytes();
        break;
      case "json":
        this.set_export_json();
        break;
      case "abi":
        this.set_export_abi();
        break;
      default:
        console.error("Unknown export type: " + type);
        this.set_export_hex();
    }
  }

  async set_export_hex() {
    this.tab_export_hex.classList.add('selected');
    this.tab_export_json.classList.remove('selected');
    this.tab_export_bytes.classList.remove('selected');
    this.tab_export_abi.classList.remove('selected');
    const program_value = (await this.app.get_program()).hex;
    this.export_program_value.innerText = program_value;
    this.program_blob = new Blob([program_value], { type: "text/plain" });
    this.program_filename = "xelis_program.txt";
    this.export_program_size.innerText = formatBytes(this.program_blob.size);
  }

  async set_export_bytes() {
    this.tab_export_hex.classList.remove('selected');
    this.tab_export_json.classList.remove('selected');
    this.tab_export_bytes.classList.add('selected');
    this.tab_export_abi.classList.remove('selected');
    const program_value = (await this.app.get_program()).bytes;
    this.export_program_value.innerText = program_value.join("");
    this.program_blob = new Blob([program_value], { type: "application/octet-stream" });
    this.program_filename = "xelis_program.bin";
    this.export_program_size.innerText = formatBytes(this.program_blob.size);
  }

  async set_export_json() {
    this.tab_export_hex.classList.remove('selected');
    this.tab_export_bytes.classList.remove('selected');
    this.tab_export_json.classList.add('selected');
    this.tab_export_abi.classList.remove('selected');
    const program_value = (await this.app.get_program()).json;
    this.export_program_value.innerHTML = `<pre style="color: inherit; margin: 0;">${program_value}</pre>`;
    this.program_blob = new Blob([program_value], { type: "text/plain" });
    this.program_filename = "xelis_program.json";
    this.export_program_size.innerText = formatBytes(this.program_blob.size);
  }

  async set_export_abi() {
    this.tab_export_hex.classList.remove('selected');
    this.tab_export_bytes.classList.remove('selected');
    this.tab_export_json.classList.remove('selected');
    this.tab_export_abi.classList.add('selected');
    const program_value = (await this.app.get_program()).abi;
    this.export_program_value.innerHTML = `<pre style="color: inherit; margin: 0;">${program_value}</pre>`;
    this.program_blob = new Blob([program_value], { type: "text/plain" });
    this.program_filename = "xelis_program.abi.json";
    this.export_program_size.innerText = formatBytes(this.program_blob.size);
  }
}
