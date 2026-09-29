export type ExportTable = {
  title: string; season: string; headers: string[]; rows: string[][];
  summary: string; scope: string; filename: string;
  sections?: { title: string; headers: string[]; rows: string[][] }[];
  notes?: string[];
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// A quoted field is not protection against spreadsheet formula evaluation.
function safeCell(value: string) {
  const text = String(value ?? "");
  const guarded = /^[\s\uFEFF\u200B]*[=+\-@\t\r]/u.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function downloadReportCSV(table: ExportTable) {
  const lines = [
    ["HK Masters", table.title],
    ["Season", table.season],
    ["Scope", table.scope],
    ["Summary", table.summary],
    ["Confidential", "Private committee data. Store securely and share only with authorised staff."],
    ...(table.notes || []).map(note => ["Report note", note]),
    [],
    ...(table.sections || [{ title: "Detail", headers: table.headers, rows: table.rows }]).flatMap(section => [
      [section.title], section.headers, ...section.rows, [],
    ]),
  ];
  download(new Blob(["\uFEFF", lines.map(row => row.map(safeCell).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  }), `${table.filename}.csv`);
}

// Paginated image-backed PDF preserves multilingual member names without relying on
// a Latin-only built-in PDF font or a browser print dialog.
export function downloadReportPDF(table: ExportTable) {
  const width = 842, height = 595, margin = 35, scale = 2;
  const bottom = height - 38;
  const sections = table.sections || [{ title: "Detail", headers: table.headers, rows: table.rows }];
  const canvases: HTMLCanvasElement[] = [];
  let ctx: CanvasRenderingContext2D;
  let y = 0;

  function newPage() {
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF canvas is unavailable.");
    canvases.push(canvas);
    ctx = context;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#fafbf9";
    ctx.fillRect(0, 0, width, height);
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "#a06747";
    ctx.fillText("HK MASTERS  /  LEAGUE & SOCIALS", margin, 30);
    y = 49;
  }

  // Character-level fallback handles long unbroken email addresses and CJK names
  // without dropping characters at line breaks.
  function wrap(value: string, font: string, availableWidth: number): string[] {
    ctx.font = font;
    const result: string[] = [];
    for (const paragraph of String(value ?? "").replace(/\r\n?/g, "\n").split("\n")) {
      let line = "";
      for (const char of Array.from(paragraph)) {
        if (line && ctx.measureText(line + char).width > availableWidth) {
          result.push(line);
          line = char;
        } else {
          line += char;
        }
      }
      result.push(line);
    }
    return result;
  }

  function paragraph(value: string, font: string, color: string, lineHeight: number, gap = 0) {
    const lines = wrap(value, font, width - margin * 2);
    for (const line of lines) {
      if (y + lineHeight > bottom) newPage();
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.fillText(line, margin, y + lineHeight - 3);
      y += lineHeight;
    }
    y += gap;
  }

  newPage();
  paragraph(table.title, "bold 22px sans-serif", "#203b55", 28, 3);
  paragraph(`Season ${table.season}  /  ${table.scope}`, "10px sans-serif", "#627487", 14, 5);
  paragraph(table.summary, "10px sans-serif", "#344f66", 14, 5);
  for (const note of table.notes || []) paragraph(note, "9px sans-serif", "#687e8b", 13, 2);
  paragraph("PRIVATE EXPORT  /  Store securely; share only with authorised committee staff.", "bold 9px sans-serif", "#915e3c", 13, 10);

  for (const section of sections) {
    const colWidth = (width - margin * 2) / Math.max(section.headers.length, 1);
    const headerLines = section.headers.map(header => wrap(header, "bold 9px sans-serif", colWidth - 10));
    const headerHeight = Math.max(1, ...headerLines.map(lines => lines.length)) * 12 + 10;
    const sectionLines = wrap(section.title, "bold 11px sans-serif", width - margin * 2);

    function heading() {
      const required = sectionLines.length * 16 + headerHeight + 20;
      if (y + required > bottom && y > 49) newPage();
      paragraph(section.title, "bold 11px sans-serif", "#203b55", 16, 6);
      if (y + headerHeight > bottom) newPage();
      ctx.fillStyle = "#e6edf0";
      ctx.fillRect(margin, y, width - margin * 2, headerHeight);
      headerLines.forEach((lines, colIndex) => lines.forEach((line, lineIndex) => {
        ctx.font = "bold 9px sans-serif";
        ctx.fillStyle = "#38546b";
        ctx.fillText(line, margin + colIndex * colWidth + 5, y + 15 + lineIndex * 12);
      }));
      y += headerHeight;
    }

    heading();
    if (!section.rows.length) paragraph("No rows match these filters.", "10px sans-serif", "#748695", 18, 4);
    section.rows.forEach((row, rowIndex) => {
      const cells = section.headers.map((_, index) => wrap(row[index] ?? "", "9px sans-serif", colWidth - 10));
      const lineCount = Math.max(1, ...cells.map(lines => lines.length));
      let offset = 0;
      while (offset < lineCount) {
        const availableLines = Math.floor((bottom - y - 10) / 12);
        if (availableLines < 1) {
          newPage();
          heading();
          continue;
        }
        const take = Math.min(lineCount - offset, availableLines);
        const rowHeight = take * 12 + 10;
        if (rowIndex % 2 === 0) {
          ctx.fillStyle = "#f0f4f5";
          ctx.fillRect(margin, y, width - margin * 2, rowHeight);
        }
        cells.forEach((lines, colIndex) => lines.slice(offset, offset + take).forEach((line, lineIndex) => {
          ctx.font = "9px sans-serif";
          ctx.fillStyle = "#284158";
          ctx.fillText(line, margin + colIndex * colWidth + 5, y + 15 + lineIndex * 12);
        }));
        y += rowHeight;
        offset += take;
      }
    });
    y += 15;
  }
  canvases.forEach((_, index) => {
    const context = canvases[index].getContext("2d");
    if (!context) throw new Error("PDF canvas is unavailable.");
    context.fillStyle = "#8798a4";
    context.font = "9px sans-serif";
    context.fillText(`Page ${index + 1} / ${canvases.length}`, width - 110, height - 20);
  });

  const totalPages = canvases.length;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const append = (value: string | Uint8Array) => {
    const bytes = typeof value === "string" ? encoder.encode(value) : value;
    chunks.push(bytes);
    length += bytes.length;
  };
  const offsets: number[] = [0];
  append("%PDF-1.4\n");
  const object = (id: number, parts: (string | Uint8Array)[]) => {
    offsets[id] = length;
    append(`${id} 0 obj\n`);
    parts.forEach(append);
    append("\nendobj\n");
  };
  const pageIds = Array.from({ length: totalPages }, (_, index) => 3 + index * 3);
  object(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  object(2, [`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${totalPages} >>`]);
  for (let page = 0; page < totalPages; page++) {
    const canvas = canvases[page];
    const binary = atob(canvas.toDataURL("image/jpeg", 0.88).split(",")[1]);
    const jpeg = Uint8Array.from(binary, char => char.charCodeAt(0));
    const pageId = pageIds[page], streamId = pageId + 1, imageId = pageId + 2;
    object(pageId, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${streamId} 0 R >>`]);
    const content = encoder.encode(`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`);
    object(streamId, [`<< /Length ${content.length} >>\nstream\n`, content, "\nendstream"]);
    object(imageId, [`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, "\nendstream"]);
  }
  const xref = length;
  append(`xref\n0 ${3 + totalPages * 3}\n0000000000 65535 f \n`);
  for (let id = 1; id < 3 + totalPages * 3; id++) append(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  append(`trailer\n<< /Size ${3 + totalPages * 3} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  download(new Blob(chunks as BlobPart[], { type: "application/pdf" }), `${table.filename}.pdf`);
}