import './globals.css';
import StoreProvider from '@/store/provider';

export const metadata = {
  title: 'PureBazar',
  description: 'Offline inventory and POS',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}