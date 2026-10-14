import './globals.css';
import StoreProvider from '@/store/provider';
import AppShell from '@/components/common/app-shell';

export const metadata = {
  title: 'PureBazar',
  description: 'Offline inventory and POS',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}