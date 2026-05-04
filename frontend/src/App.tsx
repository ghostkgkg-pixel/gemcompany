import { useState, useEffect, useCallback } from 'react';
import { SetupPage } from './components/SetupPage';
import { SimulationPage } from './components/SimulationPage';
import { initSocket } from './services/socket';

function App() {
  const [currentView, setCurrentView] = useState<'setup' | 'simulation'>('setup');

  useEffect(() => {
    // Initialize socket connection globally when the app starts
    initSocket();
  }, []);

  const handleStart = useCallback(() => setCurrentView('simulation'), []);
  const handleGoBack = useCallback(() => setCurrentView('setup'), []);

  return (
    <>
      {currentView === 'setup' ? (
        <SetupPage onStart={handleStart} />
      ) : (
        <SimulationPage onGoBack={handleGoBack} />
      )}
    </>
  );
}

export default App;
