import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 menit
      refetchOnWindowFocus: false,
    },
  },
});

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message || String(event?.reason || '');
    if (
      msg.includes('message channel closed') ||
      msg.includes('A listener indicated an asynchronous response') ||
      msg.includes('The message port closed before a response was received')
    ) {
      event.preventDefault();
    }
  });
}

if (import.meta.env.PROD) {
  console.error = () => {};
  console.warn = () => {};
  console.log = () => {};
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
