const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const example = path.join(root, '.clasp.json.example');
const dest = path.join(root, '.clasp.json');

if (!fs.existsSync(example)) {
  console.warn('ไม่พบ .clasp.json.example');
  process.exit(0);
}

if (!fs.existsSync(dest)) {
  fs.copyFileSync(example, dest);
  console.log('สร้าง .clasp.json จากตัวอย่างแล้ว');
} else {
  console.log('.clasp.json มีอยู่แล้ว');
}
