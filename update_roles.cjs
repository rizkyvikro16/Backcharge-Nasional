const fs = require('fs');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

function fixFiles() {
  const files = walk('src');
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Pattern 1: user.role === 'X'
    content = content.replace(/([a-zA-Z0-9_\?\.]+)\.role === '([^']+)'/g, "hasRole($1.role, '$2')");
    // Pattern 2: user.role !== 'X'
    content = content.replace(/([a-zA-Z0-9_\?\.]+)\.role !== '([^']+)'/g, "!hasRole($1.role, '$2')");
    // Pattern 3: (user.role as string) === 'X'
    content = content.replace(/\(([a-zA-Z0-9_\?\.]+)\.role as string\) === '([^']+)'/g, "hasRole($1.role, '$2')");
    
    if (content !== original) {
      console.log('Modified:', file);
      fs.writeFileSync(file, content);
    }
  });
}
fixFiles();
