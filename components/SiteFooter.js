export default function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-footer-inner">
      <div><strong>Soluções Condo</strong><p>© {new Date().getFullYear()} Edilson Nunes — Soluções Condo. Todos os direitos reservados.</p></div>
      <address aria-label="Contato do Soluções Condo">
        <a href="mailto:solucoes.condo.app@gmail.com">solucoes.condo.app@gmail.com</a>
        <a href="https://wa.me/5571997045391" target="_blank" rel="noopener noreferrer">WhatsApp: (71) 99704-5391</a>
        <a href="tel:+5571997045391">Ligar: (71) 99704-5391</a>
      </address>
    </div>
  </footer>;
}
