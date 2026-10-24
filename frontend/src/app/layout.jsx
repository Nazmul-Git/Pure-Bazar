import './globals.css';
import './theme.css';
import { ThemeProvider, themeInitScript } from '@/components/common/theme-provider';
import StoreProvider from '@/store/provider';
import AppShell from '@/components/common/app-shell';

export const metadata = {
  title: 'PureBazar',
  description: 'Offline inventory and POS',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <StoreProvider>
            <AppShell>{children}</AppShell>
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}