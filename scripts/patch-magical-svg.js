import fs from 'fs';
import path from 'path';

const targetFile = path.resolve('node_modules/vite-plugin-magical-svg/dist/index.js');
if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes('this.meta.rolldownVersion')) {
    content = content.replace('this.meta.rolldownVersion', 'this?.meta?.rolldownVersion');
    fs.writeFileSync(targetFile, content, 'utf8');
  }
}
