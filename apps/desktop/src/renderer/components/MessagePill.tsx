import { useCallback, useState } from 'react';
import './MessagePill.css';

export function MessagePill() {
  const [inputValue, setInputValue] = useState('');

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    
    // TODO: Implement send functionality
    console.log('Sending message:', inputValue);
    setInputValue('');
  }, [inputValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="message-pill">
      <div className="message-pill-input-area">
        <textarea
          className="message-pill-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          rows={1}
        />
        <button className="message-pill-mic-button" type="button" aria-label="Voice input">
          <svg className="message-pill-mic-icon" width="16" height="16" viewBox="0 0 140 223" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_1025_195)">
              <path d="M69.9219 171.68C111.426 171.68 139.746 143.848 139.746 103.223V83.3984C139.746 79.2969 136.523 76.0742 132.422 76.0742C128.32 76.0742 125 79.2969 125 83.3984V102.637C125 135.938 103.32 158.008 69.9219 158.008C36.4258 158.008 14.7461 135.938 14.7461 102.637V83.3984C14.7461 79.2969 11.5234 76.0742 7.32422 76.0742C3.22266 76.0742 0 79.2969 0 83.3984V103.223C0 143.848 28.3203 171.68 69.9219 171.68ZM34.375 99.707C34.375 122.168 48.8281 137.988 69.9219 137.988C90.918 137.988 105.371 122.168 105.371 99.707V38.2812C105.371 15.7227 90.918 0 69.9219 0C48.8281 0 34.375 15.7227 34.375 38.2812V99.707ZM49.1211 99.707V38.2812C49.1211 23.8281 57.4219 14.5508 69.9219 14.5508C82.4219 14.5508 90.625 23.8281 90.625 38.2812V99.707C90.625 114.16 82.4219 123.438 69.9219 123.438C57.4219 123.438 49.1211 114.16 49.1211 99.707ZM26.2695 208.984H113.477C117.578 208.984 120.898 205.762 120.898 201.66C120.898 197.559 117.578 194.238 113.477 194.238H26.2695C22.168 194.238 18.8477 197.559 18.8477 201.66C18.8477 205.762 22.168 208.984 26.2695 208.984ZM69.9219 205.762C74.0234 205.762 77.2461 202.441 77.2461 198.34V168.359C77.2461 164.258 74.0234 160.938 69.9219 160.938C65.8203 160.938 62.5 164.258 62.5 168.359V198.34C62.5 202.441 65.8203 205.762 69.9219 205.762Z" fill="currentColor" fillOpacity="0.85"/>
            </g>
            <defs>
              <clipPath id="clip0_1025_195">
                <rect width="139.746" height="222.949" fill="white"/>
              </clipPath>
            </defs>
          </svg>
        </button>
        <button
          className="message-pill-send-button"
          onClick={handleSend}
          disabled={!inputValue.trim()}
          type="button"
          aria-label="Send"
        >
          <span className="message-pill-send-icon">↑</span>
        </button>
      </div>
    </div>
  );
}
