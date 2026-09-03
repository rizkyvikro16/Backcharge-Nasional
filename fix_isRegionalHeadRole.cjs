const fs = require('fs');

let content = fs.readFileSync('src/types.ts', 'utf8');

content = content.replace(
  "export function isRegionalHeadRole(role: string): boolean {\n  return role ? role.startsWith('Regional Head') : false;\n}",
  "export function isRegionalHeadRole(role: string): boolean {\n  if (!role) return false;\n  const roles = role.split(',').map(s => s.trim());\n  return roles.some(r => r.startsWith('Regional Head'));\n}"
);

fs.writeFileSync('src/types.ts', content);
