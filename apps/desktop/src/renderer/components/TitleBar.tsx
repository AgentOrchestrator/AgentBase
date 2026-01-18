import { useState } from 'react';
import './TitleBar.css';

// Import traffic light SVG icons
import closeNormal from '../assets/traffic-lights/1-close-1-normal.svg';
import closeHover from '../assets/traffic-lights/2-close-2-hover.svg';
import closePress from '../assets/traffic-lights/2-close-3-press.svg';
import minimizeNormal from '../assets/traffic-lights/2-minimize-1-normal.svg';
import minimizeHover from '../assets/traffic-lights/2-minimize-2-hover.svg';
import minimizePress from '../assets/traffic-lights/2-minimize-3-press.svg';
import maximizeNormal from '../assets/traffic-lights/3-maximize-1-normal.svg';
import maximizeHover from '../assets/traffic-lights/3-maximize-2-hover.svg';
import maximizePress from '../assets/traffic-lights/3-maximize-3-press.svg';

declare global {
  interface Window {
    windowAPI: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
    };
  }
}

export function TitleBar() {
  const [isHovering, setIsHovering] = useState(false);
  const [pressedButton, setPressedButton] = useState<'close' | 'minimize' | 'maximize' | null>(
    null
  );

  const handleMinimize = () => {
    window.windowAPI.minimize();
  };

  const handleMaximize = () => {
    window.windowAPI.maximize();
  };

  const handleClose = () => {
    window.windowAPI.close();
  };

  const getCloseIcon = () => {
    if (pressedButton === 'close') return closePress;
    if (isHovering) return closeHover;
    return closeNormal;
  };

  const getMinimizeIcon = () => {
    if (pressedButton === 'minimize') return minimizePress;
    if (isHovering) return minimizeHover;
    return minimizeNormal;
  };

  const getMaximizeIcon = () => {
    if (pressedButton === 'maximize') return maximizePress;
    if (isHovering) return maximizeHover;
    return maximizeNormal;
  };

  return (
    <div className="titlebar">
      <div className="titlebar-drag-region" />
      <div
        className="titlebar-controls"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          setPressedButton(null);
        }}
      >
        <button
          className="titlebar-button titlebar-button-close"
          onClick={handleClose}
          onMouseDown={() => setPressedButton('close')}
          onMouseUp={() => setPressedButton(null)}
          aria-label="Close"
        >
          <img src={getCloseIcon()} alt="Close" className="traffic-light-icon" />
        </button>
        <button
          className="titlebar-button titlebar-button-minimize"
          onClick={handleMinimize}
          onMouseDown={() => setPressedButton('minimize')}
          onMouseUp={() => setPressedButton(null)}
          aria-label="Minimize"
        >
          <img src={getMinimizeIcon()} alt="Minimize" className="traffic-light-icon" />
        </button>
        <button
          className="titlebar-button titlebar-button-maximize"
          onClick={handleMaximize}
          onMouseDown={() => setPressedButton('maximize')}
          onMouseUp={() => setPressedButton(null)}
          aria-label="Maximize"
        >
          <img src={getMaximizeIcon()} alt="Maximize" className="traffic-light-icon" />
        </button>
      </div>
    </div>
  );
}
