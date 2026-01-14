import { useMemo } from 'react';
import Canvas from './Canvas';
import { NodeServicesRegistryProvider } from './context';
import { createServiceFactories } from './services';
import { TitleBar } from './components/TitleBar';
import './App.css';

function App() {
  // Create service factories once
  const factories = useMemo(() => createServiceFactories(), []);

  return (
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
  );
}

export default App;

