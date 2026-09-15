import './globals.css';
import './condo-theme.css';
import './phase3.css';
import './phase5.css';
import './payment-authorization.css';
import SiteFooter from '@/components/SiteFooter';
import TopUserMenu from '@/components/TopUserMenu';
export const metadata={title:'Soluções Condo | Gestão Operacional de Condomínios',description:'Plataforma para centralizar reservas, manutenção, checklists, inventário, ocorrências, documentos e rotinas operacionais de condomínios.'};
export default function RootLayout({children}){return <html lang="pt-BR"><body>{children}<TopUserMenu/><SiteFooter/></body></html>}
