import './globals.css';
import './condo-theme.css';
import './phase3.css';
import './phase5.css';
import SiteFooter from '@/components/SiteFooter';

export const metadata = {
  title: 'Soluções Condo | Gestão Operacional de Condomínios',
  description: 'Plataforma para centralizar reservas, manutenção, checklists, inventário, ocorrências, documentos e rotinas operacionais de condomínios.',
};

export default function RootLayout({ children }) {
  return <html lang="pt-BR"><body>{children}<SiteFooter/></body></html>;
}
