const fs = require('fs');
let code = fs.readFileSync('src/components/DatabaseView.tsx', 'utf-8');

const targetStr = `          // Value parsing
          const cleanValueStr = rawValue.replace(/[^0-9.-]+/g, '');
          const parsedValue = parseFloat(cleanValueStr) || 0;`;

const replaceStr = `          // Value parsing (Handling Indonesian / English number formats)
          let cleanValueStr = String(rawValue).replace(/[^0-9.,-]/g, '');
          
          if (cleanValueStr.includes(',') && cleanValueStr.includes('.')) {
              // e.g. 1.000.000,50 or 1,000,000.50
              const lastComma = cleanValueStr.lastIndexOf(',');
              const lastDot = cleanValueStr.lastIndexOf('.');
              if (lastComma > lastDot) {
                  // Comma is decimal: 1.000.000,50
                  cleanValueStr = cleanValueStr.replace(/\\./g, '').replace(',', '.');
              } else {
                  // Dot is decimal: 1,000,000.50
                  cleanValueStr = cleanValueStr.replace(/,/g, '');
              }
          } else if (cleanValueStr.includes(',')) {
              // e.g. 1,000,000 or 1000,50
              const parts = cleanValueStr.split(',');
              if (parts[parts.length - 1].length === 3 && parts.length > 1) {
                  // Likely thousands separator
                  cleanValueStr = cleanValueStr.replace(/,/g, '');
              } else {
                  // Decimal
                  cleanValueStr = cleanValueStr.replace(',', '.');
              }
          } else if (cleanValueStr.includes('.')) {
              // e.g. 1.000.000 or 1000.50
              const parts = cleanValueStr.split('.');
              // If there are multiple dots, or the last part is exactly 3 digits, it's likely a thousands separator (IDR)
              if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
                  cleanValueStr = cleanValueStr.replace(/\\./g, '');
              }
          }
          const parsedValue = Math.round(parseFloat(cleanValueStr)) || 0;`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/components/DatabaseView.tsx', code);
  console.log('Successfully patched value parsing');
} else {
  console.log('Target string not found');
}
