import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { api, NotFound } from './api/client'
import { Layout } from './Layout'
import { PageView } from './PageView'
import { applyBranding } from './theme'
import { useAsync } from './useAsync'

export default function App() {
  const config = useAsync((s) => api.config(s), 'config')
  const site = useAsync((s) => api.site(s), 'site')

  useEffect(() => {
    if (config.status === 'ready') applyBranding(config.data.branding)
  }, [config])

  if (config.status === 'error' || site.status === 'error') {
    const unknown = [config, site].some((r) => r.status === 'error' && r.error instanceof NotFound)
    return (
      <main className="center">
        <h1>{unknown ? 'This website is not available' : 'We could not load the website'}</h1>
        <p>{unknown ? 'Please check the address.' : 'Please try again in a moment.'}</p>
      </main>
    )
  }
  if (config.status !== 'ready' || site.status !== 'ready') return <div className="center" aria-busy="true" />

  return (
    <Layout config={config.data} site={site.data}>
      <Routes>
        <Route path="/" element={<PageView slug="home" site={site.data} />} />
        <Route path="/:slug" element={<PageView site={site.data} />} />
      </Routes>
    </Layout>
  )
}
