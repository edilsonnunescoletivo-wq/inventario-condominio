# Atualização operacional — setembro de 2026

## Ativação

1. Entre como administrador e abra **Implantação**. Confira os cadastros e use a prévia da importação CSV antes de confirmar.
2. Cadastre e-mail e unidade dos moradores. Em **Acessos dos moradores**, gere a senha inicial e entregue-a ao titular. O portal fica em `/morador` e exige o CNPJ do condomínio.
3. Configure as regras e o regulamento de cada área em **Reservas**. As reservas usam o fuso de Salvador (America/Bahia).
4. Execute os checklists. Irregularidades podem abrir ordens de serviço; o executor registra fotos, relato, custo total e materiais. A gestão aprova ou devolve. A saída de estoque ocorre somente na aprovação.
5. Publique comunicados para o público adequado e acompanhe as confirmações de leitura por versão.

A recuperação de senha é assistida pela administração: a solicitação aparece no painel e o administrador confirma a identidade antes de entregar um link de uso único, válido por 30 minutos. Esta versão não envia o link por e-mail automaticamente.

A demonstração pública e o vídeo usam dados fictícios. Controle de Ponto permanece em desenvolvimento e fora desta atualização.

## Publicação e compatibilidade

Aplicar `migrations/20260910_operacao.sql` e depois `migrations/20260911_reserva_timezone.sql` antes do código. A primeira migração é aditiva; a segunda preserva o ajuste legado de três horas para clientes antigos e permite horários explícitos nos novos handlers via configuração local à transação.

Validação: `npm ci`, `npm test`, `npm run build`. Os testes usam PGlite com esquema isolado, sem registros de clientes. Cobrem permissões, isolamento por condomínio, reservas, revisão e estoque, importação, comunicados e recuperação de senha. A serialização do adaptador de testes não substitui um teste de carga no PostgreSQL remoto.

Em caso de reversão do código, manter as colunas e tabelas aditivas. Não remover dados das novas funcionalidades. A função de horário mantém compatibilidade com a versão anterior.
