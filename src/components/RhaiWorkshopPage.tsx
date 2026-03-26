import * as React from 'react';
import Helmet from 'react-helmet';
import { Tabs, Tab, TabTitleText } from '@patternfly/react-core';

interface TutorialEntry {
  name: string;
  url: string;
}

interface WorkshopConfig {
  openshiftAiUrl: string;
  tutorialUrls: TutorialEntry[];
}

const DEFAULT_CONFIG: WorkshopConfig = {
  openshiftAiUrl: 'https://data-science-gateway.apps.ocp.cloud.rhai-tmm.dev/',
  tutorialUrls: [
    { name: 'Voice Agents', url: 'https://eformat.github.io/voice-agents/voice-agents/index.html' },
    { name: 'Rainforest', url: 'https://eformat.github.io/rainforest-docs' },
  ],
};

function useWorkshopConfig(): WorkshopConfig {
  const [config, setConfig] = React.useState<WorkshopConfig>(DEFAULT_CONFIG);

  React.useEffect(() => {
    fetch('/api/plugins/rhai-workshop-plugin/config.json')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('config not found');
      })
      .then((data: any) => {
        const merged: Partial<WorkshopConfig> = {};
        if (data.openshiftAiUrl) merged.openshiftAiUrl = data.openshiftAiUrl;
        if (Array.isArray(data.tutorialUrls)) merged.tutorialUrls = data.tutorialUrls;
        setConfig((prev) => ({ ...prev, ...merged }));
      })
      .catch(() => {});
  }, []);

  return config;
}

// Find the xterm textarea in the active terminal tab and paste text into it.
function pasteIntoTerminal(text: string) {
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
  const [activeTab, setActiveTab] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'copy' && typeof event.data.text === 'string') {
        pasteIntoTerminal(event.data.text);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

  const onMouseDown = React.useCallback(() => {
    dragging.current = true;
  }, []);

  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
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

  const showTabs = config.tutorialUrls.length > 1;
  const currentUrl = config.tutorialUrls[activeTab]?.url || '';

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
            }}
          />
        </div>
        {/* Right pane: tabs + tutorial iframe */}
        <div
          style={{
            width: `${100 - leftWidth}%`,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          {showTabs && (
            <Tabs
              activeKey={activeTab}
              onSelect={(_e, key) => setActiveTab(key as number)}
              isBox={false}
              style={{ flexShrink: 0 }}
            >
              {config.tutorialUrls.map((entry, idx) => (
                <Tab
                  key={idx}
                  eventKey={idx}
                  title={<TabTitleText>{entry.name}</TabTitleText>}
                />
              ))}
            </Tabs>
          )}
          <iframe
            title="Tutorial"
            style={{
              flex: 1,
              border: 'none',
              width: '100%',
              pointerEvents: dragging.current ? 'none' : 'auto',
            }}
            src={currentUrl}
          />
        </div>
      </div>
    </>
  );
}
