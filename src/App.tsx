import { useEffect } from 'react'
import { useStore } from './store/store'
import UsernameEntry from './components/UsernameEntry'
import CollectionLoading from './components/CollectionLoading'
import ComparisonView from './components/ComparisonView'
import ErrorDisplay from './components/ErrorDisplay'
import SyncingView from './components/SyncingView'

function App() {
  const view = useStore(s => s.view)
  const comparisonsTotal = useStore(s => s.comparisonsTotal)
  const comparisonsAtLastSync = useStore(s => s.comparisonsAtLastSync)

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    if (comparisonsTotal > comparisonsAtLastSync) {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [comparisonsTotal, comparisonsAtLastSync])

  return (
    <div className="bg-gray-50 min-h-screen">
      {view === 'entry' && <UsernameEntry />}
      {view === 'loading' && <CollectionLoading />}
      {view === 'comparison' && <ComparisonView />}
      {view === 'error' && <ErrorDisplay />}
      {view === 'syncing' && <SyncingView />}
    </div>
  )
}

export default App
