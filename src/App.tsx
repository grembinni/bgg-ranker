import { useStore } from './store/store'
import UsernameEntry from './components/UsernameEntry'
import CollectionLoading from './components/CollectionLoading'
import ComparisonView from './components/ComparisonView'
import ErrorDisplay from './components/ErrorDisplay'

function App() {
  const view = useStore(s => s.view)
  return (
    <div className="bg-gray-50 min-h-screen">
      {view === 'entry' && <UsernameEntry />}
      {view === 'loading' && <CollectionLoading />}
      {view === 'comparison' && <ComparisonView />}
      {view === 'error' && <ErrorDisplay />}
    </div>
  )
}

export default App
