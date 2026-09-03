const fs = require('fs');

const filesToFix = [
  'src/App.tsx',
  'src/components/Dashboard.tsx',
  'src/components/DatabaseView.tsx',
  'src/components/DetailModal.tsx',
  'src/components/FeedbackView.tsx',
  'src/components/UserManagement.tsx',
  'src/supabaseClient.ts'
];

filesToFix.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Find import from '../types' or './types'
  if (content.includes("from './types'")) {
     content = content.replace(/import\s+{([^}]+)}\s+from\s+'\.\/types'/, (match, p1) => {
         if (!p1.includes('hasRole')) return `import { ${p1.trim()}, hasRole } from './types'`;
         return match;
     });
  } else if (content.includes("from '../types'")) {
     content = content.replace(/import\s+{([^}]+)}\s+from\s+'\.\.\/types'/, (match, p1) => {
         if (!p1.includes('hasRole')) return `import { ${p1.trim()}, hasRole } from '../types'`;
         return match;
     });
  }
  
  fs.writeFileSync(file, content);
});
