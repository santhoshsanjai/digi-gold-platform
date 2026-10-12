import { RouterProvider } from 'react-router-dom'
import { ErrorBoundary } from '@digigold/web-common/components/ErrorBoundary.tsx'
import { AppProviders } from './providers/AppProviders.tsx'
import { appRouter } from './routes/appRouter.tsx'

function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <RouterProvider router={appRouter} />
      </AppProviders>
    </ErrorBoundary>
  )
}

export default App
