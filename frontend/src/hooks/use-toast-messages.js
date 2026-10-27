'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

// Fires floating toasts whenever the given success/error message changes to a non-empty value.
export default function useToastMessages({ success = '', error = '' } = {}) {
  useEffect(() => {
    if (success) toast.success(success);
  }, [success]);
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);
}
