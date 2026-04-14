/**
 * scripts/gen-icon.cjs
 * Gera src/assets/icon.png (256x256) e src/assets/icon.ico a partir do SVG do farol.
 * Uso: node scripts/gen-icon.cjs
 */

const { Resvg } = require('@resvg/resvg-js')
const fs = require('fs')
const path = require('path')

// ── SVG do farol (estático, sem animação — baseado no FarolLogo do Sidebar) ──
const SIZE = 256
const svg = `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Fundo com borda arredondada -->
  <rect width="32" height="32" rx="7" fill="#B9915B" fill-opacity="0.12"/>
  <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" stroke="#B9915B" stroke-opacity="0.4"/>

  <!-- Feixe estático (posição frontal — mais brilhante) -->
  <g clip-path="url(#boxClip)">
    <path d="M16 10.75 L42 4 L42 17.5 Z" fill="#E8C17A" fill-opacity="0.55"/>
  </g>
  <clipPath id="boxClip">
    <rect width="32" height="32" rx="7"/>
  </clipPath>

  <!-- Base -->
  <rect x="12" y="27" width="8" height="3" rx="1.2" fill="#B9915B"/>

  <!-- Torre -->
  <rect x="14" y="14" width="4" height="13" fill="#B9915B" fill-opacity="0.85"/>
  <!-- Listras escuras na torre -->
  <rect x="14" y="16" width="4" height="1.4" fill="#001F35" fill-opacity="0.3"/>
  <rect x="14" y="20" width="4" height="1.4" fill="#001F35" fill-opacity="0.3"/>
  <rect x="14" y="24" width="4" height="1.4" fill="#001F35" fill-opacity="0.3"/>

  <!-- Varanda -->
  <rect x="12.5" y="13" width="7" height="1.5" rx="0.7" fill="#B9915B"/>

  <!-- Câmara da lanterna -->
  <rect x="13.5" y="8.5" width="5" height="4.5" rx="0.8" fill="#001F35"/>
  <rect x="13.5" y="8.5" width="5" height="4.5" rx="0.8" stroke="#B9915B" stroke-width="0.6"/>

  <!-- Vidros iluminados -->
  <rect x="14.2" y="9.2" width="1.5" height="3" rx="0.4" fill="#E8C17A" fill-opacity="0.75"/>
  <rect x="16.2" y="9.2" width="1.5" height="3" rx="0.4" fill="#E8C17A" fill-opacity="0.35"/>

  <!-- Cúpula -->
  <path d="M13.5 8.5 Q16 5.5 18.5 8.5 Z" fill="#B9915B"/>

  <!-- Antena -->
  <line x1="16" y1="5.5" x2="16" y2="4" stroke="#E8C17A" stroke-width="1" stroke-linecap="round"/>
</svg>
`

const outDir = path.join(__dirname, '..', 'src', 'assets')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

// SVG → PNG
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: SIZE },
  background: 'rgba(0,0,0,0)',
})
const pngData = resvg.render()
const pngBuffer = pngData.asPng()
const pngPath = path.join(outDir, 'icon.png')
fs.writeFileSync(pngPath, pngBuffer)
console.log(`✓ PNG gerado: ${pngPath} (${pngBuffer.length} bytes)`)
