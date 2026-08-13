const fs = require('fs');
let code = fs.readFileSync('src/components/DetailModal.tsx', 'utf8');

code = code.replace(
  "setModalApprovalNotes(transaction.approval_note || '');",
  "setModalApprovalNotes(transaction.approval_note || '');\n      setApprovalAttachment1(transaction.approval_attachment_1_url || null);\n      setApprovalAttachment2(transaction.approval_attachment_2_url || null);\n      setApprovalAttachment3(transaction.approval_attachment_3_url || null);"
);

fs.writeFileSync('src/components/DetailModal.tsx', code);
