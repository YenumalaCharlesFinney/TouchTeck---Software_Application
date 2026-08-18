declare global {
  interface Window {
    touchteckApp?: {
      printHtml?: (html: string) => Promise<boolean>;
      [key: string]: any;
    };
  }
}

export async function printHtmlDocument(title: string, bodyHtml: string) {
  const fullHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #1e293b; line-height: 1.4; font-size: 12px; background: #ffffff; }
      .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px; position: relative; }
      .header h1 { font-size: 20px; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a; }
      .header h2 { font-size: 14px; font-weight: 700; color: #0284c7; margin: 4px 0 0 0; }
      .meta-info { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 12px; background: #f8fafc; padding: 6px 12px; border-radius: 4px; border: 1px solid #e2e8f0; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
      th { background-color: #0f172a; color: #ffffff; font-weight: 700; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #0f172a; }
      td { padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155; }
      tr:nth-child(even) { background-color: #f8fafc; }
      .rank-col { width: 45px; text-align: center; }
      .heat-col { width: 45px; text-align: center; }
      .lane-col { width: 45px; text-align: center; }
      .time-col { width: 90px; text-align: right; font-weight: 700; color: #0284c7; }
      .status-col { width: 80px; text-align: center; }
      @media print {
        body { padding: 0; background: #ffffff; }
        @page { size: auto; margin: 8mm; }
        .heat-page, .event-page { break-inside: avoid; }
        .heat-page:not(:last-child), .event-page:not(:last-child) { page-break-after: always; break-after: page; }
      }
    </style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`;

  if (window.touchteckApp && typeof window.touchteckApp.printHtml === 'function') {
    try {
      const res = await window.touchteckApp.printHtml(fullHtml);
      if (res) return;
    } catch (e) {
      console.warn('Native IPC print failed, falling back to window print', e);
    }
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    try { printWindow.print(); } catch (e) {}
  }, 400);
}
