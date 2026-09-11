import fs from 'fs';
import { Resvg } from '@resvg/resvg-js';

const svgContent = fs.readFileSync('public/favicon.svg', 'utf-8');

function renderPng(size, filename) {
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: size,
    },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  fs.writeFileSync(filename, pngBuffer);
  console.log(`Rendered ${filename} (${size}x${size})`);
}

renderPng(32, 'public/favicon-32x32.png');
renderPng(32, 'public/favicon.ico');
renderPng(192, 'public/icon-192.png');
renderPng(180, 'public/apple-touch-icon.png');
renderPng(512, 'public/icon-512.png');

console.log('All Spartan icons successfully rendered to PNG!');
