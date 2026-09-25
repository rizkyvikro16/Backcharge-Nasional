sed -i 's/    const year = new Date().getFullYear();/    const newId = await generateNextTransactionId();/g' src/App.tsx
