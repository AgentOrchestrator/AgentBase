'use client';

interface AnimatedLineWithCircleProps {
  className?: string;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  isPinned?: boolean;
  disabled?: boolean;
}

export function AnimatedPin({ className = '', size = 16, onClick, title, isPinned = false, disabled = false }: AnimatedLineWithCircleProps) {
  return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
        title={title}
      >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={`transition-colors duration-50 ${
          isPinned 
            ? 'text-primary hover:text-primary/80' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <defs>
          <style>
            {`
              .line {
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                fill: none;
                stroke-dasharray: 20;
                stroke-dashoffset: 0;
                animation: none;
              }
              
              .circle {
                fill: currentColor;
                opacity: 1;
              }
              
              .circle-inner {
                fill: var(--background);
                opacity: 1;
              }
              
              button:hover .line {
                animation: drawLine 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                animation-delay: 0ms;
              }
              
              @keyframes drawLine {
                0% { stroke-dashoffset: 0; }
                50% { stroke-dashoffset: 10; }
                100% { stroke-dashoffset: 0; }
              }
            `}
          </style>
        </defs>
        
        {/* Diagonal line (top-right to bottom-left) */}
        <line className="line" x1="18" y1="6" x2="6" y2="18" />
        
        {/* Circle at the top-right end */}
        <circle className="circle" cx="18" cy="6" r="4" />
        
        {/* Smaller inner circle */}
        <circle className="circle-inner" cx="18" cy="4" r="1" />
      </svg>
    </button>
  );
}
