const fs = require('fs');
let code = fs.readFileSync('src/components/DetailModal.tsx', 'utf8');

code = code.replace(
  "const [modalApprovalStatus, setModalApprovalStatus] = useState<string>('Disetujui');",
  "const [modalApprovalStatus, setModalApprovalStatus] = useState<string>('Disetujui');\n  const [approvalAttachment1, setApprovalAttachment1] = useState<string | null>(null);\n  const [approvalAttachment2, setApprovalAttachment2] = useState<string | null>(null);\n  const [approvalAttachment3, setApprovalAttachment3] = useState<string | null>(null);"
);

fs.writeFileSync('src/components/DetailModal.tsx', code);
