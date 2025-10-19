'use client';

interface AnimatedXProps {
  className?: string;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

export function AnimatedXMark({ className = '', size = 16, onClick, title }: AnimatedXProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center transition-all duration-200 ${className}`}
      title={title}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="text-muted-foreground hover:text-foreground transition-colors duration-50"
      >
        <defs>
          <style>
            {`
              .x-line {
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                fill: none;
                stroke-dasharray: 20;
                stroke-dashoffset: 0;
              }
              
              .x-line-1 {
                stroke-dasharray: 20;
                stroke-dashoffset: 0;
                animation: none;
              }
              
              .x-line-2 {
                stroke-dasharray: 20;
                stroke-dashoffset: 0;
                animation: none;
              }
              
              button:hover .x-line-1 {
                animation: drawX1 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                animation-delay: 0ms;
              }
              
              button:hover .x-line-2 {
                animation: drawX2 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                animation-delay: 150ms;
              }
              
              @keyframes drawX1 {
                0% { stroke-dashoffset: 0; }
                50% { stroke-dashoffset: 20; }
                100% { stroke-dashoffset: 0; }
              }
              
              @keyframes drawX2 {
                0% { stroke-dashoffset: 0; }
                50% { stroke-dashoffset: 20; }
                100% { stroke-dashoffset: 0; }
              }
            `}
          </style>
        </defs>
        
        {/* First diagonal line (top-left to bottom-right) */}
        <line className="x-line x-line-1" x1="6" y1="6" x2="18" y2="18" />
        
        {/* Second diagonal line (top-right to bottom-left) */}
        <line className="x-line x-line-2" x1="18" y1="6" x2="6" y2="18" />
      </svg>
    </button>
  );
}
