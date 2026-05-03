import { useState, useEffect } from 'react';
import { SetupPage } from './components/SetupPage';
import { SimulationPage } from './components/SimulationPage';
import { initSocket } from './services/socket';

function App() {
  const [currentView, setCurrentView] = useState<'setup' | 'simulation'>('setup');

  useEffect(() => {
    // Initialize socket connection globally when the app starts
    initSocket();
  }, []);

  return (
    <>
      {currentView === 'setup' ? (
        <SetupPage onStart={() => setCurrentView('simulation')} />
      ) : (
        <SimulationPage onGoBack={() => setCurrentView('setup')} />
      )}
    </>
  );
}

export default App;
