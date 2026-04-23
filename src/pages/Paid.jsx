// Rota /paid foi consolidada em /meta (Meta Ads).
// Redireciona automaticamente para não quebrar links existentes.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function PaidPage() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/meta', { replace: true }) }, [navigate])
  return null
}
