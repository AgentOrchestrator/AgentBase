/// <reference types="vite/client" />

// Declare SVG module imports (Vite handles these as URLs)
declare module '*.svg' {
  const content: string;
  export default content;
}
