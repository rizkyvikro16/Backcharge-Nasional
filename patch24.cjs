const fs = require('fs');
let code = fs.readFileSync('src/components/DetailModal.tsx', 'utf8');

code = code.replace(
  "approval_note: modalApprovalNotes.trim() || null",
  "approval_note: modalApprovalNotes.trim() || null,\n        approval_attachment_1_url: approvalAttachment1,\n        approval_attachment_2_url: approvalAttachment2,\n        approval_attachment_3_url: approvalAttachment3"
);

fs.writeFileSync('src/components/DetailModal.tsx', code);
