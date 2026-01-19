'use client';

export default function GlobalErrorPage({
  reset,
}: {
  error: globalThis.Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
          }}
        >
          <h1
            style={{
              fontSize: '3.75rem',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '1rem',
            }}
          >
            Error
          </h1>
          <p
            style={{
              fontSize: '1.25rem',
              color: '#4B5563',
              marginBottom: '2rem',
            }}
          >
            Something went wrong
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#111827',
              color: 'white',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
