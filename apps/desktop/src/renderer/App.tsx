import { useEffect, useMemo } from 'react';
import Canvas from './Canvas';
import { TitleBar } from './components/TitleBar';
import { NodeServicesRegistryProvider, ThemeProvider } from './context';
import {
  createServiceFactories,
  notificationSoundService,
  sharedEventDispatcher,
} from './services';
import './App.css';

function App() {
  // Create service factories once
  const factories = useMemo(() => createServiceFactories(), []);

  // Initialize shared event dispatcher (single IPC listener for all agent events)
  // Initialize notification sound service (plays sound on new permission requests)
  useEffect(() => {
    sharedEventDispatcher.initialize();
    notificationSoundService.initialize();
    return () => {
      sharedEventDispatcher.dispose();
      notificationSoundService.dispose();
    };
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
