import { MainLayoutShell } from '@/_shared';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <MainLayoutShell>{children}</MainLayoutShell>;
}
