import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Select custom — dropdown com animação, sem <select> nativo.
 *
 * Props:
 *   value          — valor atual
 *   onChange       — (newValue) => void
 *   options        — [{ value, label }]  ou  [{ label, options: [{value,label}] }] (grupos)
 *   placeholder    — texto quando sem seleção
 *   minWidth       — largura mínima do botão (default 120)
 *   small          — boolean, reduz padding/fonte
 */
export default function Select({ value, onChange, options = [], placeholder = 'Todos', minWidth = 120, small = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Flatten para achar label do valor atual
  const flat = options.flatMap(o => o.options ? o.options : [o])
  const current = flat.find(o => o.value === value)
  const label   = current?.label ?? placeholder

  const isActive = value !== '' && value !== null && value !== undefined

  const fs  = small ? 11 : 12
  const pad = small ? '4px 8px' : '5px 10px'

  return (
    <div ref={ref} className="frl-select" style={{ minWidth, position: 'relative', zIndex: open ? 99999 : 'auto' }}>
      <button
        type="button"
        className={`frl-select__btn${isActive ? ' frl-select__btn--active' : ''}`}
        style={{ fontSize: fs, padding: pad, minWidth }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <ChevronDown size={small ? 10 : 11} className={`frl-select__chevron${open ? ' frl-select__chevron--open' : ''}`} />
      </button>

      {open && (
        <div className="frl-select__menu" style={{ minWidth }}>
          {/* Opção vazia / placeholder */}
          <div
            className={`frl-select__option${!isActive ? ' frl-select__option--selected' : ''}`}
            onMouseDown={() => { onChange(''); setOpen(false) }}
          >
            {placeholder}
          </div>

          {options.map((opt, i) => {
            if (opt.options) {
              // Grupo
              return (
                <div key={i}>
                  <div style={{ padding: '6px 12px 3px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(138,160,180,0.5)', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    {opt.label}
                  </div>
                  {opt.options.map((o, j) => (
                    <div
                      key={j}
                      className={`frl-select__option${o.value === value ? ' frl-select__option--selected' : ''}`}
                      style={{ paddingLeft: 20 }}
                      onMouseDown={() => { onChange(o.value); setOpen(false) }}
                    >
                      {o.label}
                    </div>
                  ))}
                </div>
              )
            }
            return (
              <div
                key={i}
                className={`frl-select__option${opt.value === value ? ' frl-select__option--selected' : ''}`}
                onMouseDown={() => { onChange(opt.value); setOpen(false) }}
              >
                {opt.label}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
