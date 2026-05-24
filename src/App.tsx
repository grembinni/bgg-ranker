import { useStore } from './store/store'
import UsernameEntry from './components/UsernameEntry'
import CollectionLoading from './components/CollectionLoading'
import ErrorDisplay from './components/ErrorDisplay'

function App() {
  const view = useStore(s => s.view)
  return (
    <div className="bg-gray-50 min-h-screen">
      {view === 'entry' && <UsernameEntry />}
      {view === 'loading' && <CollectionLoading />}
      {view === 'comparison' && <ComparisonPlaceholder />}
      {view === 'error' && <ErrorDisplay />}
    </div>
  )
}

function ComparisonPlaceholder() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-center">
      <p className="text-base text-gray-700">Collection loaded. Comparison view ships in Plan 02-03.</p>
    </div>
  )
}

export default App
