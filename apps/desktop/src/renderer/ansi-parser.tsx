import React from 'react';

interface AnsiStyle {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

interface AnsiToken {
  text: string;
  style: AnsiStyle;
}

// ANSI color codes mapping
const ANSI_COLORS: { [key: number]: string } = {
  30: '#000000', // black
  31: '#cd3131', // red
  32: '#0dbc79', // green
  33: '#e5e510', // yellow
  34: '#2472c8', // blue
  35: '#bc3fbc', // magenta
  36: '#11a8cd', // cyan
  37: '#e5e5e5', // white
  90: '#666666', // bright black
  91: '#f14c4c', // bright red
  92: '#23d18b', // bright green
  93: '#f5f543', // bright yellow
  94: '#3b8eea', // bright blue
  95: '#d670d6', // bright magenta
  96: '#29b8db', // bright cyan
  97: '#e5e5e5', // bright white
};

const ANSI_BG_COLORS: { [key: number]: string } = {
  40: '#000000', // black
  41: '#cd3131', // red
  42: '#0dbc79', // green
  43: '#e5e510', // yellow
  44: '#2472c8', // blue
  45: '#bc3fbc', // magenta
  46: '#11a8cd', // cyan
  47: '#e5e5e5', // white
  100: '#666666', // bright black
  101: '#f14c4c', // bright red
  102: '#23d18b', // bright green
  103: '#f5f543', // bright yellow
  104: '#3b8eea', // bright blue
  105: '#d670d6', // bright magenta
  106: '#29b8db', // bright cyan
  107: '#e5e5e5', // bright white
};

// Default style (reset)
const DEFAULT_STYLE: AnsiStyle = {};

/**
 * Parse ANSI escape codes from a string and return tokens with styles
 */
export function parseAnsi(text: string): AnsiToken[] {
  const tokens: AnsiToken[] = [];
  let currentStyle: AnsiStyle = { ...DEFAULT_STYLE };
  let buffer = '';
  let i = 0;

  // Handle carriage returns - replace \r\n with \n, and \r without \n should overwrite current line
  // For simplicity, we'll just remove standalone \r characters (they're often used for line updates)
  text = text.replace(/\r\n/g, '\n').replace(/\r(?!\n)/g, '');

  while (i < text.length) {
    // Look for ESC[ sequence
    if (text[i] === '\x1b' || text[i] === '\u001b') {
      // Emit buffered text if any
      if (buffer) {
        tokens.push({ text: buffer, style: { ...currentStyle } });
        buffer = '';
      }

      // Check for [ (CSI sequence)
      if (i + 1 < text.length && text[i + 1] === '[') {
        i += 2; // Skip ESC[
        
        // Parse the code sequence
        let codeStr = '';
        while (i < text.length && text[i] !== 'm' && text[i] !== 'J' && text[i] !== 'K' && text[i] !== 'H' && text[i] !== 'f') {
          codeStr += text[i];
          i++;
        }
        
        // Skip the terminating character (usually 'm' for SGR)
        if (i < text.length && text[i] === 'm') {
          i++; // Skip 'm'
          
          // Parse the codes
          const codes = codeStr.split(';').map(c => parseInt(c, 10)).filter(c => !isNaN(c));
          
          if (codes.length === 0 || codes[0] === 0) {
            // Reset
            currentStyle = { ...DEFAULT_STYLE };
          } else {
            // Apply styles
            let j = 0;
            while (j < codes.length) {
              const code = codes[j];
              
              // Style codes
              if (code === 1) {
                currentStyle.bold = true;
              } else if (code === 2) {
                currentStyle.dim = true;
              } else if (code === 3) {
                currentStyle.italic = true;
              } else if (code === 4) {
                currentStyle.underline = true;
              } else if (code === 9) {
                currentStyle.strikethrough = true;
              } else if (code === 22) {
                currentStyle.bold = false;
                currentStyle.dim = false;
              } else if (code === 23) {
                currentStyle.italic = false;
              } else if (code === 24) {
                currentStyle.underline = false;
              } else if (code === 29) {
                currentStyle.strikethrough = false;
              }
              // Foreground colors (30-37, 90-97)
              else if (code >= 30 && code <= 37) {
                currentStyle.color = ANSI_COLORS[code];
              } else if (code >= 90 && code <= 97) {
                currentStyle.color = ANSI_COLORS[code];
              }
              // Background colors (40-47, 100-107)
              else if (code >= 40 && code <= 47) {
                currentStyle.backgroundColor = ANSI_BG_COLORS[code];
              } else if (code >= 100 && code <= 107) {
                currentStyle.backgroundColor = ANSI_BG_COLORS[code];
              }
              // 256-color support (38;5;n or 48;5;n)
              else if (code === 38 && j + 2 < codes.length && codes[j + 1] === 5) {
                const colorIndex = codes[j + 2];
                currentStyle.color = get256Color(colorIndex);
                j += 2;
              } else if (code === 48 && j + 2 < codes.length && codes[j + 1] === 5) {
                const colorIndex = codes[j + 2];
                currentStyle.backgroundColor = get256Color(colorIndex);
                j += 2;
              }
              // Truecolor support (38;2;r;g;b or 48;2;r;g;b)
              else if (code === 38 && j + 4 < codes.length && codes[j + 1] === 2) {
                const r = codes[j + 2];
                const g = codes[j + 3];
                const b = codes[j + 4];
                currentStyle.color = `rgb(${r}, ${g}, ${b})`;
                j += 4;
              } else if (code === 48 && j + 4 < codes.length && codes[j + 1] === 2) {
                const r = codes[j + 2];
                const g = codes[j + 3];
                const b = codes[j + 4];
                currentStyle.backgroundColor = `rgb(${r}, ${g}, ${b})`;
                j += 4;
              }
              
              j++;
            }
          }
        } else {
          // Skip other ANSI sequences (cursor movement, etc.)
          i++;
        }
      } else {
        // Not a CSI sequence, treat as normal character
        buffer += text[i];
        i++;
      }
    } else {
      buffer += text[i];
      i++;
    }
  }

  // Emit remaining buffered text
  if (buffer) {
    tokens.push({ text: buffer, style: { ...currentStyle } });
  }

  return tokens;
}

/**
 * Get 256-color palette color
 */
function get256Color(index: number): string {
  if (index < 16) {
    // Standard colors (0-15)
    return ANSI_COLORS[30 + index] || ANSI_COLORS[90 + (index - 8)] || '#d4d4d4';
  } else if (index < 232) {
    // 6x6x6 color cube (16-231)
    const remainder = index - 16;
    const r = Math.floor(remainder / 36);
    const g = Math.floor((remainder % 36) / 6);
    const b = remainder % 6;
    const rgbR = r === 0 ? 0 : (r * 40 + 55);
    const rgbG = g === 0 ? 0 : (g * 40 + 55);
    const rgbB = b === 0 ? 0 : (b * 40 + 55);
    return `rgb(${rgbR}, ${rgbG}, ${rgbB})`;
  } else {
    // Grayscale (232-255)
    const gray = (index - 232) * 10 + 8;
    return `rgb(${gray}, ${gray}, ${gray})`;
  }
}

/**
 * Convert ANSI tokens to React elements
 */
export function ansiToReact(tokens: AnsiToken[], keyPrefix?: string): React.ReactNode[] {
  return tokens.map((token, index) => {
    const style: React.CSSProperties = {};
    
    if (token.style.color) {
      style.color = token.style.color;
    }
    if (token.style.backgroundColor) {
      style.backgroundColor = token.style.backgroundColor;
    }
    if (token.style.bold) {
      style.fontWeight = 'bold';
    }
    if (token.style.dim) {
      style.opacity = 0.7;
    }
    if (token.style.italic) {
      style.fontStyle = 'italic';
    }
    if (token.style.underline) {
      style.textDecoration = 'underline';
    }
    if (token.style.strikethrough) {
      style.textDecoration = 'line-through';
    }

    // Only wrap in span if there are styles
    const hasStyles = Object.keys(style).length > 0;
    
    if (hasStyles) {
      return (
        <span key={`${keyPrefix || 'ansi'}-${index}`} style={style}>
          {token.text}
        </span>
      );
    }
    
    return <React.Fragment key={`${keyPrefix || 'ansi'}-${index}`}>{token.text}</React.Fragment>;
  });
}

