import { useMemo } from 'react';
import Canvas from './Canvas';
import { NodeServicesRegistryProvider } from './context';
import { createServiceFactories } from './services';
import './App.css';

function App() {
  // Create service factories once
  const factories = useMemo(() => createServiceFactories(), []);

  return (
    <NodeServicesRegistryProvider factories={factories}>
      <div className="app">
        <Canvas />
      </div>
    </NodeServicesRegistryProvider>
  );
}

export default App;

