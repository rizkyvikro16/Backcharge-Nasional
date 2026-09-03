const fs = require('fs');

let content = fs.readFileSync('src/components/UserManagement.tsx', 'utf8');

// 1. Change type of state
content = content.replace("const [role, setRole] = useState<UserRole>('ASO');", "const [role, setRole] = useState<string>('ASO');");

// 2. Change handleRoleChange definition if any
// It's used inline: `onChange={(e) => handleRoleChange(e.target.value as UserRole)}`
// Let's see how `handleRoleChange` is defined.
