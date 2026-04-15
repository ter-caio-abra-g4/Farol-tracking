# Farol Tracking — Pendências Operacionais

> Última atualização: 2026-04-15
> Pendências que requerem ação manual no GTM, GA4, GSC ou Meta — fora do código.

---

## GTM

### [ ] Publicar workspace 44 — GTM-MJT8CNGM
- **O que:** Workspace 44 tem mudanças aprovadas pendentes de publicação
- **Como:** GTM UI → Container GTM-MJT8CNGM → Workspace 44 → Publicar
- **Impacto:** Tags novas ou editadas não estão live até publicar

### [ ] Corrigir GA4 pausado — GTM-54PR3S2R (checkout)
- **O que:** 4 tags de GA4 estão com status "Pausado" no container de checkout
- **Como:** GTM UI → Container GTM-54PR3S2R → Tags → filtrar "pausado" → reativar
- **Impacto:** Eventos de checkout não chegam ao GA4

### [ ] Corrigir variável login_state → event_category — GTM-WFTGXLRD
- **O que:** Variável `login_state` referenciada em trigger mas o campo correto é `event_category`
- **Como:** GTM UI → Container GTM-WFTGXLRD → Variáveis → renomear / corrigir referência
- **Impacto:** Segmentação por estado de login quebrada

---

## GA4

### [ ] Adicionar service account na property 525799105
- **O que:** Property 525799105 não tem o service account `g4analyticsca@security-logs-438613.iam.gserviceaccount.com` adicionado
- **Como:** GA4 Admin → Property 525799105 → Gerenciamento de acesso → Adicionar usuário → cole o email acima com papel "Leitor"
- **Impacto:** Farol não consegue puxar dados desta property (retorna mock)

---

## Google Search Console

### [ ] Admin adicionar service account como owner em g4educacao.com
- **O que:** `g4analyticsca@security-logs-438613.iam.gserviceaccount.com` precisa de permissão "Owner" na propriedade `g4educacao.com`
- **Como:** Search Console → Propriedade `g4educacao.com` → Configurações → Usuários e permissões → Adicionar usuário → Owner
- **Impacto:** Dados de GSC para g4educacao.com retornam mock

---

## Meta

### [ ] Renovar token de acesso em 23/05/2026
- **O que:** Token atual expira em **24/05/2026** (token de longa duração, 60 dias)
- **Como:** Meta Business Manager → Ferramentas → Explorador de API → Gerar novo token de longa duração → colar em Settings do Farol
- **Lembrete:** Criar lembrete para 23/05 para não deixar expirar

---

## Farol — Melhorias de código pendentes (backlog)

| ID | Descrição |
|----|-----------|
| R8a | Setup wizard — adicionar passo de Databricks no fluxo G4 OS detectado (feito parcialmente) |
| R9a | GTM.jsx — unificar múltiplos indicadores de mock em isMock único passado ao Header |
| R9b | SEO.jsx — mesma consolidação |
| FUT-1 | Setup wizard — tela de progresso pós-setup mostrando o que está LIVE vs mock |
| FUT-2 | Notificação nativa quando token Meta está a <7 dias de expirar |
| FUT-3 | Auto-refresh configurável por página (hoje é global) |
