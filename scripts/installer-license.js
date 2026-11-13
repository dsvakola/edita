// Writes installer/license.txt, shown on the installer's licence page:
// the NOTICE (credits) followed by the full GNU GPL v3 text.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const notice = fs.readFileSync(path.join(root, 'NOTICE'), 'utf8').trim();
const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8').trim();

const text = [
  `Edita ${pkg.version} - Licence`,
  '',
  notice,
  '',
  '----------------------------------------------------------------------',
  '',
  license,
  '',
].join('\n');

fs.mkdirSync(path.join(root, 'installer'), { recursive: true });
// NSIS shows the licence as plain text; CRLF line ends and a UTF-8 BOM keep it readable.
fs.writeFileSync(path.join(root, 'installer', 'license.txt'), `﻿${text.replace(/\r?\n/g, '\r\n')}`);
console.log('installer/license.txt written');
