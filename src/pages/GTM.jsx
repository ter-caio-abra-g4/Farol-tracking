import { useState } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import { Tag, Zap, Variable, ChevronDown, ChevronRight } from 'lucide-react'

// Containers reais — fonte: GTM API (08/04/2026)
const CONTAINERS = [
  // G4 Educacao — conta 4702993840
  { id: 'GTM-MJT8CNGM', name: 'G4 Educacao - Global',       account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null, lastPublished: null },
  { id: 'GTM-PMNN5VZ',  name: 'G4 Educacao [PROD]',         account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null, lastPublished: null },
  { id: 'GTM-KWL8CBD',  name: 'G4 Educacao [DEV]',          account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null, lastPublished: null },
  { id: 'GTM-WV3RZ85',  name: 'G4 Educacao - SKILLS [PROD]',account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null, lastPublished: null },
  { id: 'GTM-54PR3S2R', name: 'G4 Educacao - Selfcheckout', account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null, lastPublished: null },
  { id: 'GTM-WP8MWKMB', name: 'G4 Educacao - GTM',          account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null, lastPublished: null },
  { id: 'GTM-WFTGXLRD', name: 'G4 Educacao - Lead Gen',     account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null, lastPublished: null },
  // G4 Tools — conta 6341042624
  { id: 'GTM-M6NWZ5N8', name: 'tools.g4educacao.com',       account: 'G4 Tools',    status: 'loading', tags: null, triggers: null, variables: null, lastPublished: null },
]

const TAGS = {
  'GTM-MJT8CNGM': [
    { name: 'GA4 Base Tag', type: 'Google Analytics', status: 'ok', triggers: ['All Pages'] },
    { name: 'Meta Pixel Base', type: 'Custom HTML', status: 'ok', triggers: ['All Pages'] },
    { name: 'Meta Pixel Purchase', type: 'Custom HTML', status: 'ok', triggers: ['purchase_dataLayer'] },
    { name: 'Meta Pixel Lead', type: 'Custom HTML', status: 'ok', triggers: ['lead_dataLayer', 'form_submit'] },
    { name: 'GA4 purchase', type: 'Google Analytics', status: 'ok', triggers: ['purchase_dataLayer'] },
    { name: 'GA4 lead', type: 'Google Analytics', status: 'ok', triggers: ['lead_dataLayer'] },
    { name: 'GA4 video_start', type: 'Google Analytics', status: 'error', triggers: [] },
    { name: 'GA4 scroll_depth', type: 'Google Analytics', status: 'warn', triggers: ['scroll_25'] },
    { name: 'Hotjar', type: 'Custom HTML', status: 'ok', triggers: ['All Pages'] },
    { name: 'Clarity', type: 'Custom HTML', status: 'ok', triggers: ['All Pages'] },
    { name: 'GA4 click_cta', type: 'Google Analytics', status: 'warn', triggers: ['click_cta_btn'] },
  ],
  'GTM-PMNN5VZ': [
    { name: 'GA4 Base Tag', type: 'Google Analytics', status: 'ok', triggers: ['All Pages'] },
    { name: 'Meta Pixel Base', type: 'Custom HTML', status: 'warn', triggers: ['All Pages'] },
    { name: 'GA4 purchase', type: 'Google Analytics', status: 'ok', triggers: ['purchase_dataLayer'] },
    { name: 'GA4 lead', type: 'Google Analytics', status: 'warn', triggers: [] },
    { name: 'Hotjar', type: 'Custom HTML', status: 'ok', triggers: ['All Pages'] },
  ],
  'GTM-M6NWZ5N8': [
    { name: 'GA4 Base Tag', type: 'Google Analytics', status: 'ok', triggers: ['All Pages'] },
    { name: 'Meta Pixel Base', type: 'Custom HTML', status: 'ok', triggers: ['All Pages'] },
    { name: 'GA4 lead', type: 'Google Analytics', status: 'ok', triggers: ['lead_form'] },
    { name: 'Meta Pixel Lead', type: 'Custom HTML', status: 'ok', triggers: ['lead_form'] },
  ],
}

export default function GTMPage() {
  const [selectedId, setSelectedId] = useState(CONTAINERS[0].id)
  const [expandedTag, setExpandedTag] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const selectedContainer = CONTAINERS.find((c) => c.id === selectedId)
  const tags = TAGS[selectedId] ?? []

  const handleRefresh = () => {
    setLastUpdated(new Date().toISOString())
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="GTM"
        subtitle="Containers, tags e triggers"
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
        select={{
          label: 'Container:',
          value: selectedId,
          onChange: (val) => { setSelectedId(val); setExpandedTag(null) },
          groups: [
            {
              label: 'G4 Educacao',
              options: CONTAINERS.filter((c) => c.account === 'G4 Educacao').map((c) => ({ value: c.id, label: c.name + ' — ' + c.id })),
            },
            {
              label: 'G4 Tools',
              options: CONTAINERS.filter((c) => c.account === 'G4 Tools').map((c) => ({ value: c.id, label: c.name + ' — ' + c.id })),
            },
          ],
        }}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {CONTAINERS.map((c) => (
            <Card
              key={c.id}
              style={{
                cursor: 'pointer',
                borderColor: selectedId === c.id ? '#B9915B' : 'rgba(185,145,91,0.25)',
                boxShadow: selectedId === c.id ? '0 0 0 1px rgba(185,145,91,0.25)' : 'none',
                transition: 'all 0.15s',
              }}
              onClick={() => { setSelectedId(c.id); setExpandedTag(null) }}
            >
              <CardBody>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 14, color: selectedId === c.id ? '#B9915B' : '#F5F4F3' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 2 }}>{c.id}</div>
                  </div>
                  <StatusBadge status={c.status} size="sm" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { icon: Tag, val: c.tags, label: 'Tags' },
                    { icon: Zap, val: c.triggers, label: 'Triggers' },
                    { icon: Variable, val: c.variables, label: 'Vars' },
                  ].map(({ icon: Icon, val, label }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#F5F4F3' }}>{val ?? '—'}</div>
                      <div style={{ fontSize: 10, color: '#8A9BAA' }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 10 }}>Publicado em {c.lastPublished}</div>
              </CardBody>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader
            title={'Tags — ' + selectedContainer.name}
            action={
              <div style={{ fontSize: 12, color: '#8A9BAA' }}>
                {tags.filter((t) => t.status === 'error').length} erros · {tags.filter((t) => t.status === 'warn').length} avisos
              </div>
            }
          />
          <div>
            {tags.map((tag, i) => (
              <div key={tag.name}>
                <div
                  onClick={() => setExpandedTag(expandedTag === i ? null : i)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '12px 20px', cursor: 'pointer',
                    borderBottom: '1px solid rgba(185,145,91,0.08)',
                    background: expandedTag === i ? 'rgba(185,145,91,0.05)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (expandedTag !== i) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={(e) => { if (expandedTag !== i) e.currentTarget.style.background = 'transparent' }}
                >
                  {expandedTag === i
                    ? <ChevronDown size={14} color="#8A9BAA" style={{ marginRight: 10 }} />
                    : <ChevronRight size={14} color="#8A9BAA" style={{ marginRight: 10 }} />
                  }
                  <Tag size={13} color="#B9915B88" style={{ marginRight: 10 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#F5F4F3' }}>{tag.name}</span>
                  <span style={{ fontSize: 11, color: '#8A9BAA', background: 'rgba(138,155,170,0.1)', padding: '2px 8px', borderRadius: 4, marginRight: 12 }}>
                    {tag.type}
                  </span>
                  <StatusBadge status={tag.status} size="sm" />
                </div>
                {expandedTag === i && (
                  <div style={{ padding: '12px 20px 14px 52px', background: 'rgba(185,145,91,0.03)', borderBottom: '1px solid rgba(185,145,91,0.08)' }}>
                    <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 6 }}>Triggers vinculados:</div>
                    {tag.triggers.length === 0 ? (
                      <span style={{ fontSize: 12, color: '#EF4444' }}>Nenhum trigger — tag nao vai disparar</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {tag.triggers.map((t) => (
                          <span key={t} style={{ background: 'rgba(185,145,91,0.12)', border: '1px solid rgba(185,145,91,0.25)', color: '#B9915B', padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}