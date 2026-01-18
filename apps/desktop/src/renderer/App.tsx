import { useEffect, useMemo } from 'react';
import Canvas from './Canvas';
import { TitleBar } from './components/TitleBar';
import { NodeServicesRegistryProvider, ThemeProvider } from './context';
import { createServiceFactories, sharedEventDispatcher } from './services';
import './App.css';

function App() {
  // Create service factories once
  const factories = useMemo(() => createServiceFactories(), []);

  // Initialize shared event dispatcher (single IPC listener for all agent events)
  useEffect(() => {
    sharedEventDispatcher.initialize();
    return () => sharedEventDispatcher.dispose();
  }, []);

  return (
    <ThemeProvider>
      <NodeServicesRegistryProvider factories={factories}>
        <div className="app">
          <TitleBar />
          <div className="app-content">
            <div className="app-sidebar app-sidebar-left" />
            <Canvas />
            <div className="app-sidebar app-sidebar-right" />
          </div>
          <div className="app-bottom-bar" />
        </div>
      </NodeServicesRegistryProvider>
    </ThemeProvider>
  );
}

export default App;
