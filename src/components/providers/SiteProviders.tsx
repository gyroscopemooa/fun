import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Toaster } from 'sonner';

export default function SiteProviders() {
  return (
    <ThemeProvider>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
