const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, '..', 'dist', 'client');
const assetsDir = path.join(clientDir, 'assets');

if (!fs.existsSync(clientDir) || !fs.existsSync(assetsDir)) {
  console.error('dist/client or dist/client/assets not found — run build first');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const indexJs = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
const stylesCss = files.find((f) => f.startsWith('styles-') && f.endsWith('.css'));

if (!indexJs) {
  console.error('Could not find client index JS file in dist/client/assets');
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tinu Barber — Queue Management</title>
    <base href="/" />
    ${stylesCss ? `<link rel="stylesheet" href="/assets/${stylesCss}">` : ''}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${indexJs}"></script>
  </body>
</html>
`;

fs.writeFileSync(path.join(clientDir, 'index.html'), html, 'utf8');
console.log('Wrote dist/client/index.html');
