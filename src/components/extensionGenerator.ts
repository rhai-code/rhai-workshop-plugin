// Generates browser extension zip files with the current cluster's console hostname.
// Uses a minimal zip implementation — no external dependencies needed.

function getConsoleHostname(): string {
  return window.location.hostname;
}

// -- Minimal ZIP creator for small text files (store-only, no compression) --

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files: Record<string, string>): Blob {
  const encoder = new TextEncoder();
  const entries: { name: Uint8Array; data: Uint8Array; crc: number; offset: number }[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const dataBytes = encoder.encode(content);
    const crc = crc32(dataBytes);

    // Local file header
    const header = new ArrayBuffer(30 + nameBytes.length);
    const hv = new DataView(header);
    hv.setUint32(0, 0x04034b50, true); // signature
    hv.setUint16(4, 20, true);          // version needed
    hv.setUint16(6, 0, true);           // flags
    hv.setUint16(8, 0, true);           // compression: store
    hv.setUint16(10, 0, true);          // mod time
    hv.setUint16(12, 0, true);          // mod date
    hv.setUint32(14, crc, true);        // crc32
    hv.setUint32(18, dataBytes.length, true); // compressed size
    hv.setUint32(22, dataBytes.length, true); // uncompressed size
    hv.setUint16(26, nameBytes.length, true); // name length
    hv.setUint16(28, 0, true);          // extra length
    new Uint8Array(header).set(nameBytes, 30);

    const headerBytes = new Uint8Array(header);
    parts.push(headerBytes);
    parts.push(dataBytes);
    entries.push({ name: nameBytes, data: dataBytes, crc, offset });
    offset += headerBytes.length + dataBytes.length;
  }

  // Central directory
  const cdStart = offset;
  for (const entry of entries) {
    const cd = new ArrayBuffer(46 + entry.name.length);
    const cv = new DataView(cd);
    cv.setUint32(0, 0x02014b50, true);  // signature
    cv.setUint16(4, 20, true);           // version made by
    cv.setUint16(6, 20, true);           // version needed
    cv.setUint16(8, 0, true);            // flags
    cv.setUint16(10, 0, true);           // compression
    cv.setUint16(12, 0, true);           // mod time
    cv.setUint16(14, 0, true);           // mod date
    cv.setUint32(16, entry.crc, true);   // crc32
    cv.setUint32(20, entry.data.length, true); // compressed size
    cv.setUint32(24, entry.data.length, true); // uncompressed size
    cv.setUint16(28, entry.name.length, true); // name length
    cv.setUint16(30, 0, true);           // extra length
    cv.setUint16(32, 0, true);           // comment length
    cv.setUint16(34, 0, true);           // disk start
    cv.setUint16(36, 0, true);           // internal attrs
    cv.setUint32(38, 0, true);           // external attrs
    cv.setUint32(42, entry.offset, true); // local header offset
    const cdBytes = new Uint8Array(cd);
    cdBytes.set(entry.name, 46);
    parts.push(cdBytes);
    offset += cdBytes.length;
  }
  const cdSize = offset - cdStart;

  // End of central directory
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);   // signature
  ev.setUint16(4, 0, true);             // disk number
  ev.setUint16(6, 0, true);             // cd disk
  ev.setUint16(8, entries.length, true); // entries on disk
  ev.setUint16(10, entries.length, true); // total entries
  ev.setUint32(12, cdSize, true);        // cd size
  ev.setUint32(16, cdStart, true);       // cd offset
  ev.setUint16(20, 0, true);            // comment length
  parts.push(new Uint8Array(eocd));

  return new Blob(parts as unknown as BlobPart[], { type: 'application/zip' });
}

// -- Extension file generators --

function chromeManifest(host: string): string {
  return JSON.stringify({
    manifest_version: 3,
    name: 'RHAI Console Iframe Unblocker',
    description: `Strips X-Frame-Options and frame-ancestors headers from ${host} so it can be embedded in the RHAI Workshop plugin iframe.`,
    version: '1.0.0',
    permissions: ['declarativeNetRequest', 'declarativeNetRequestWithHostAccess'],
    host_permissions: [`https://${host}/*`],
    background: { service_worker: 'background.js' },
  }, null, 2);
}

function chromeBackground(host: string): string {
  return `// Auto-generated for ${host}
const IFRAME_HOSTS = ['${host}'];

chrome.runtime.onInstalled.addListener(() => {
  const rules = IFRAME_HOSTS.map((host, index) => ({
    id: index + 1,
    condition: {
      requestDomains: [host],
      resourceTypes: ['sub_frame'],
    },
    action: {
      type: 'modifyHeaders',
      responseHeaders: [
        { header: 'X-Frame-Options', operation: 'remove' },
        { header: 'Frame-Options', operation: 'remove' },
        { header: 'Content-Security-Policy', operation: 'remove' },
      ],
    },
  }));

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(r => r.id),
    addRules: rules,
  });
});
`;
}

function firefoxManifest(host: string): string {
  return JSON.stringify({
    manifest_version: 2,
    name: 'RHAI Console Iframe Unblocker',
    description: `Strips X-Frame-Options and frame-ancestors headers from ${host} so it can be embedded in the RHAI Workshop plugin iframe.`,
    version: '1.0.0',
    permissions: ['webRequest', 'webRequestBlocking', `https://${host}/*`],
    background: { scripts: ['background.js'] },
    browser_specific_settings: { gecko: { id: 'rhai-iframe-unblocker@redhat.com' } },
  }, null, 2);
}

function firefoxBackground(host: string): string {
  return `// Auto-generated for ${host}
const IFRAME_HOSTS = ['${host}'];
const STRIP_HEADERS = ['x-frame-options', 'frame-options', 'content-security-policy'];
const urls = IFRAME_HOSTS.map(h => \`https://\${h}/*\`);

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    return {
      responseHeaders: details.responseHeaders.filter(
        (h) => !STRIP_HEADERS.includes(h.name.toLowerCase())
      ),
    };
  },
  { urls, types: ['sub_frame'] },
  ['blocking', 'responseHeaders']
);
`;
}

// -- Public API --

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadChromeExtension() {
  const host = getConsoleHostname();
  const zip = createZip({
    'manifest.json': chromeManifest(host),
    'background.js': chromeBackground(host),
  });
  downloadBlob(zip, 'rhai-iframe-unblocker-chrome.zip');
}

export function downloadFirefoxExtension() {
  const host = getConsoleHostname();
  const zip = createZip({
    'manifest.json': firefoxManifest(host),
    'background.js': firefoxBackground(host),
  });
  downloadBlob(zip, 'rhai-iframe-unblocker-firefox.zip');
}
