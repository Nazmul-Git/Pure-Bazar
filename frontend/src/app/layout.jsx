import './globals.css';
import './theme.css';
import { ThemeProvider, themeInitScript } from '@/components/common/theme-provider';
import StoreProvider from '@/store/provider';
import AppToaster from '@/components/common/toaster';
import { LanguageProvider } from '@/i18n/language-provider';
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
          <StoreProvider><LanguageProvider>
            <AppShell>{children}</AppShell>
            <AppToaster />
          </LanguageProvider></StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}