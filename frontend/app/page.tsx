'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const token = useStore((s) => s.token);

  useEffect(() => {
    if (token) {
      router.replace('/conversations');
    } else {
      router.replace('/login');
    }
  }, [token, router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  );
}
