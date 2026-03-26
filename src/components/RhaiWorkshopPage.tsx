import * as React from 'react';
import Helmet from 'react-helmet';

interface WorkshopConfig {
  openshiftAiUrl: string;
  tutorialUrl: string;
}

const DEFAULT_CONFIG: WorkshopConfig = {
  openshiftAiUrl: 'https://data-science-gateway.apps.ocp.cloud.rhai-tmm.dev/',
  tutorialUrl: 'https://eformat.github.io/voice-agents/voice-agents/index.html',
};

function useWorkshopConfig(): WorkshopConfig {
  const [config, setConfig] = React.useState<WorkshopConfig>(DEFAULT_CONFIG);

  React.useEffect(() => {
    fetch('/api/plugins/rhai-workshop-plugin/config.json')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('config not found');
      })
      .then((data: Partial<WorkshopConfig>) => {
        setConfig((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
  }, []);

  return config;
}

// Find the xterm textarea in the active terminal tab and paste text into it.
function pasteIntoTerminal(text: string) {
  // Target the active tab panel so paste goes to whichever terminal
  // the user has selected. Inactive panels have the `hidden` attribute.
  const activePanel = document.querySelector(
    'section[role="tabpanel"]:not([hidden])',
  );
  const textarea = (activePanel || document).querySelector(
    'textarea.xterm-helper-textarea',
  ) as HTMLTextAreaElement | null;

  if (textarea) {
    textarea.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });
    textarea.dispatchEvent(pasteEvent);
  }
}

export default function RhaiWorkshopPage() {
  const config = useWorkshopConfig();
  const [leftWidth, setLeftWidth] = React.useState(50);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  // Listen for postMessage from the tutorial iframe.
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'copy' && typeof event.data.text === 'string') {
        pasteIntoTerminal(event.data.text);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-open the web terminal on page load.
  React.useEffect(() => {
    const openTerminal = () => {
      const btn = document.querySelector(
        'button[data-quickstart-id="qs-masthead-cloudshell"]',
      ) as HTMLButtonElement | null;
      if (btn) {
        const terminalFrame = document.querySelector(
          'iframe[title="Command line terminal"]',
        );
        if (!terminalFrame) {
          btn.click();
        }
      }
    };
    const timer = setTimeout(openTerminal, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Splitter drag handlers
  const onMouseDown = React.useCallback(() => {
    dragging.current = true;
  }, []);

  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      // Clamp between 20% and 80%
      setLeftWidth(Math.min(80, Math.max(20, pct)));
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>RHAI Workshop</title>
      </Helmet>
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: 'row',
          height: 'calc(100vh - 50px)',
          width: '100%',
        }}
      >
        <iframe
          title="OpenShift AI"
          style={{
            width: `${leftWidth}%`,
            border: 'none',
            height: '100%',
            pointerEvents: dragging.current ? 'none' : 'auto',
          }}
          src={config.openshiftAiUrl}
        />
        {/* Resizable splitter */}
        <div
          onMouseDown={onMouseDown}
          style={{
            width: '6px',
            cursor: 'col-resize',
            backgroundColor: '#d2d2d2',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '2px',
              height: '24px',
              borderLeft: '1px solid #8a8d90',
              borderRight: '1px solid #8a8d90',
              gap: '2px',
            }}
          />
        </div>
        <iframe
          title="Tutorial"
          style={{
            width: `${100 - leftWidth}%`,
            border: 'none',
            height: '100%',
            pointerEvents: dragging.current ? 'none' : 'auto',
          }}
          src={config.tutorialUrl}
        />
      </div>
    </>
  );
}
