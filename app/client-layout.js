'use client'

import Navigation from '@/components/shared/Navigation'

export default function ClientLayout({ children }) {
  const date = new Date();
  const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;

  return (
    <Navigation formattedDate={formattedDate}>
      {children}
    </Navigation>
  );
}