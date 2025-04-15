import { open_modal } from './modal/index.js';
import formatBytes from 'https://cdn.jsdelivr.net/npm/format-bytes@1.0.1/+esm'

const modal_export = document.getElementById('modal_export');
const btn_export_download = document.getElementById('btn_export_download');
const btn_export_copy = document.getElementById('btn_export_copy');
const tab_export_hex = document.getElementById('tab_export_hex');
const tab_export_bytes = document.getElementById('tab_export_bytes');
const tab_export_json = document.getElementById('tab_export_json');
const export_program_value = document.getElementById('export_program_value');
const btn_export = document.getElementById('btn_export');
const export_program_size = document.getElementById('export_program_size');

let program_blob = null;
let program_filename = null;

btn_export.addEventListener("click", () => {
  open_modal(modal_export);

  const export_type = localStorage.getItem("export-tab", "hex");
  switch (export_type) {
    case "hex":
      set_export_hex();
      break;
    case "bytes":
      set_export_bytes();
      break;
    case "json":
      set_export_json();
      break;
    default:
      console.error("Unknown export type: " + export_type);
      set_export_hex();
  }
});

function set_export_hex() {
  tab_export_hex.classList.add('selected');
  tab_export_json.classList.remove('selected');
  tab_export_bytes.classList.remove('selected');
  const program_value = globalThis.get_program().to_hex();
  export_program_value.innerText = program_value;
  program_blob = new Blob([program_value], { type: "text/plain" });
  program_filename = "xelis_program.txt";
  export_program_size.innerText = formatBytes(program_blob.size);
}

function set_export_bytes() {
  tab_export_hex.classList.remove('selected');
  tab_export_json.classList.remove('selected');
  tab_export_bytes.classList.add('selected');
  const program_value = globalThis.get_program().to_bytes();
  export_program_value.innerText = program_value.join("");
  program_blob = new Blob([program_value], { type: "application/octet-stream" });
  program_filename = "xelis_program.bin";
  export_program_size.innerText = formatBytes(program_blob.size);
}

function set_export_json() {
  tab_export_hex.classList.remove('selected');
  tab_export_bytes.classList.remove('selected');
  tab_export_json.classList.add('selected');
  const program_value = globalThis.get_program().to_json();
  export_program_value.innerText = program_value;
  program_blob = new Blob([program_value], { type: "text/plain" });
  program_filename = "xelis_program.json";
  export_program_size.innerText = formatBytes(program_blob.size);
}

tab_export_hex.addEventListener('click', () => {
  localStorage.setItem("export-tab", "hex");
  set_export_hex();
});

tab_export_bytes.addEventListener('click', () => {
  localStorage.setItem("export-tab", "bytes");
  set_export_bytes();
});

tab_export_json.addEventListener('click', () => {
  localStorage.setItem("export-tab", "json");
  set_export_json();
});

btn_export_copy.addEventListener('click', () => {
  const program_value = export_program_value.innerText;
  navigator.clipboard.writeText(program_value);
  alert('Program copied to clipboard.');
});

btn_export_download.addEventListener('click', () => {
  var a = document.createElement(`a`);
  a.href = URL.createObjectURL(program_blob);
  a.download = program_filename;
  a.click();
});