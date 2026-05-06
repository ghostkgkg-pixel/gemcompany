import { useState, useEffect, useCallback } from 'react';
import { SetupPage } from './components/SetupPage';
import { SimulationPage } from './components/SimulationPage';
import { IntroPage } from './components/IntroPage';
import { initSocket } from './services/socket';

function App() {
  const [currentView, setCurrentView] = useState<'intro' | 'setup' | 'simulation'>('intro');

  useEffect(() => {
    // Initialize socket connection globally when the app starts
    initSocket();
  }, []);

  const handleStart = useCallback(() => setCurrentView('simulation'), []);
  const handleOpenLobby = useCallback(() => setCurrentView('setup'), []);
  const handleGoBack = useCallback(() => setCurrentView('intro'), []);

  return (
    <>
      {currentView === 'intro' && (
        <IntroPage onStartSimulation={handleStart} onOpenLobby={handleOpenLobby} />
      )}
      {currentView === 'setup' && (
        <SetupPage onStart={handleStart} onBack={handleGoBack} />
      )}
      {currentView === 'simulation' && (
        <SimulationPage onGoBack={handleGoBack} />
      )}
    </>
  );
}

export default App;
