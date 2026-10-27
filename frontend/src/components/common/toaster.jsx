'use client';

import { Toaster } from 'sonner';

export default function AppToaster() {
  return <Toaster position="top-right" duration={3500} richColors closeButton />;
}
