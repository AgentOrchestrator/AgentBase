import { type NodeProps, NodeResizer } from '@xyflow/react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import './BrowserNode.css';

interface BrowserNodeData {
  browserId: string;
  url?: string;
}

function BrowserNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as BrowserNodeData;
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentUrl, setCurrentUrl] = useState(nodeData.url || '');
  const [inputUrl, setInputUrl] = useState(nodeData.url || '');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [pageTitle, setPageTitle] = useState('');

  // Normalize URL - return as-is, don't modify
  const normalizeUrl = useCallback((url: string): string => {
    return url.trim();
  }, []);

  // Handle URL submission
  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const normalizedUrl = normalizeUrl(inputUrl);
      console.log('[BrowserNode] URL submit:', { inputUrl, normalizedUrl });
      if (normalizedUrl) {
        // Just set the URL - the webview will be mounted/updated by React
        setCurrentUrl(normalizedUrl);
        setInputUrl(normalizedUrl);
      }
    },
    [inputUrl, normalizeUrl]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        // Reset input to current URL
        setInputUrl(currentUrl);
        inputRef.current?.blur();
      }
    },
    [currentUrl]
  );

  // Navigation handlers
  const handleBack = useCallback(() => {
    if (webviewRef.current && canGoBack) {
      webviewRef.current.goBack();
    }
  }, [canGoBack]);

  const handleForward = useCallback(() => {
    if (webviewRef.current && canGoForward) {
      webviewRef.current.goForward();
    }
  }, [canGoForward]);

  const handleReload = useCallback(() => {
    if (webviewRef.current) {
      webviewRef.current.reload();
    }
  }, []);

  // Setup webview event listeners - runs when currentUrl changes (webview mounts/unmounts)
  useEffect(() => {
    const webview = webviewRef.current;
    console.log(
      '[BrowserNode] Setting up webview listeners, webview exists:',
      !!webview,
      'currentUrl:',
      currentUrl
    );
    if (!webview) return;

    const handleDomReady = () => {
      console.log('[BrowserNode] DOM ready');
    };

    const handleDidStartLoading = () => {
      console.log('[BrowserNode] Started loading');
      setIsLoading(true);
    };

    const handleDidStopLoading = () => {
      console.log('[BrowserNode] Stopped loading');
      setIsLoading(false);
      if (webview) {
        setCanGoBack(webview.canGoBack());
        setCanGoForward(webview.canGoForward());
      }
    };

    const handleDidNavigate = (e: Electron.DidNavigateEvent) => {
      console.log('[BrowserNode] Did navigate:', e.url);
      setCurrentUrl(e.url);
      setInputUrl(e.url);
      if (webview) {
        setCanGoBack(webview.canGoBack());
        setCanGoForward(webview.canGoForward());
      }
    };

    const handleDidNavigateInPage = (e: Electron.DidNavigateInPageEvent) => {
      if (e.isMainFrame) {
        console.log('[BrowserNode] Did navigate in page:', e.url);
        setCurrentUrl(e.url);
        setInputUrl(e.url);
        if (webview) {
          setCanGoBack(webview.canGoBack());
          setCanGoForward(webview.canGoForward());
        }
      }
    };

    const handlePageTitleUpdated = (e: Electron.PageTitleUpdatedEvent) => {
      console.log('[BrowserNode] Page title updated:', e.title);
      setPageTitle(e.title);
    };

    const handleDidFailLoad = (e: Electron.DidFailLoadEvent) => {
      setIsLoading(false);
      console.error(
        '[BrowserNode] Failed to load:',
        e.errorCode,
        e.errorDescription,
        e.validatedURL
      );
    };

    const handleConsoleMessage = (e: Electron.ConsoleMessageEvent) => {
      console.log('[BrowserNode] Console:', e.message);
    };

    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-start-loading', handleDidStartLoading);
    webview.addEventListener('did-stop-loading', handleDidStopLoading);
    webview.addEventListener('did-navigate', handleDidNavigate as EventListener);
    webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage as EventListener);
    webview.addEventListener('page-title-updated', handlePageTitleUpdated as EventListener);
    webview.addEventListener('did-fail-load', handleDidFailLoad as EventListener);
    webview.addEventListener('console-message', handleConsoleMessage as EventListener);

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-start-loading', handleDidStartLoading);
      webview.removeEventListener('did-stop-loading', handleDidStopLoading);
      webview.removeEventListener('did-navigate', handleDidNavigate as EventListener);
      webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage as EventListener);
      webview.removeEventListener('page-title-updated', handlePageTitleUpdated as EventListener);
      webview.removeEventListener('did-fail-load', handleDidFailLoad as EventListener);
      webview.removeEventListener('console-message', handleConsoleMessage as EventListener);
    };
  }, [currentUrl]); // Re-run when currentUrl changes to attach listeners to newly mounted webview

  // Focus input when node is selected and no URL yet
  useEffect(() => {
    if (selected && !currentUrl && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selected, currentUrl]);

  // Handle wheel events when node is selected - prevent canvas scrolling
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !selected) return;

    const handleWheel = (e: Event) => {
      e.stopPropagation();
    };

    // Cast to HTMLElement for standard addEventListener signature
    (webview as unknown as HTMLElement).addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      (webview as unknown as HTMLElement).removeEventListener('wheel', handleWheel);
    };
  }, [selected]);

  return (
    <div className={`browser-node ${selected ? 'selected' : ''}`}>
      <NodeResizer
        minWidth={400}
        minHeight={300}
        isVisible={true}
        lineStyle={{ borderColor: 'transparent' }}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: '50%',
        }}
      />

      {/* Browser Header with URL bar */}
      <div className="browser-node-header">
        <div className="browser-controls">
          <button
            className="browser-nav-button"
            onClick={handleBack}
            disabled={!canGoBack}
            title="Go back"
          >
            ←
          </button>
          <button
            className="browser-nav-button"
            onClick={handleForward}
            disabled={!canGoForward}
            title="Go forward"
          >
            →
          </button>
          <button className="browser-nav-button" onClick={handleReload} title="Reload">
            {isLoading ? '×' : '↻'}
          </button>
        </div>

        <form className="browser-url-form" onSubmit={handleUrlSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="browser-url-input"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter URL or search..."
            spellCheck={false}
          />
        </form>
      </div>

      {/* Page title bar (optional) */}
      {pageTitle && (
        <div className="browser-title-bar">
          <span className="browser-page-title">{pageTitle}</span>
        </div>
      )}

      {/* Webview container */}
      <div className="browser-content">
        {currentUrl ? (
          <webview
            ref={webviewRef as React.RefObject<Electron.WebviewTag>}
            src={currentUrl}
            className="browser-webview"
            // @ts-expect-error - webview attributes not fully typed
            allowpopups=""
          />
        ) : (
          <div className="browser-empty-state">
            <div className="browser-empty-icon">🌐</div>
            <div className="browser-empty-text">Enter a URL above to start browsing</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowserNode;
