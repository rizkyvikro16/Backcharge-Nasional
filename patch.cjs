const fs = require('fs');
let code = fs.readFileSync('src/components/DetailModal.tsx', 'utf8');

code = code.replace(`  const handleSetPaid = () => {
    const confirmMessage = \`Konfirmasi Status Lunas:\\nApakah Anda yakin ingin mengubah status pembayaran transaksi ini menjadi "Lunas"? Tindakan ini akan menyelesaikan alur transaksi denda.\`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    onUpdateStatus(
      transaction.id,
      { status_payment: 'Lunas' },
      \`Admin mengonfirmasi pelunasan pembayaran tagihan dari Customer\`
    );
  };`, `  const handleSetPaid = () => {
    if (!modalPaymentDate) {
      alert("Silakan masukkan tanggal aktual pembayaran lunas.");
      return;
    }
    const confirmMessage = \`Konfirmasi Status Lunas:\\nApakah Anda yakin ingin mengubah status pembayaran transaksi ini menjadi "Lunas"? Tanggal lunas: \${modalPaymentDate}. Tindakan ini akan menyelesaikan alur transaksi denda.\`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    onUpdateStatus(
      transaction.id,
      { status_payment: 'Lunas', payment_date: modalPaymentDate },
      \`Admin mengonfirmasi pelunasan pembayaran tagihan dari Customer pada \${modalPaymentDate}\`
    );
    setShowActionForm(null);
  };`);

fs.writeFileSync('src/components/DetailModal.tsx', code);
