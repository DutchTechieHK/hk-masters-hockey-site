import type { LineupBoard, LineupWorkspace } from "@workspace/api-client-react";
import { hkFull } from "./staff-utils";

export type PublishedImage = { board: LineupBoard; publishedAt: string };

/** Deliberately has no draft fallback, even for a newer saved private revision. */
export function publishedImageSource(workspace: Pick<LineupWorkspace, "published" | "publishedAt">): PublishedImage {
  if (!workspace.published || !workspace.publishedAt) {
    throw new Error("No lineup is published now. Publish a lineup before exporting.");
  }
  return { board: structuredClone(workspace.published), publishedAt: workspace.publishedAt };
}

export function lineupImageFilename(matchId: number, publishedAt: string) {
  return `match-${matchId}-published-${publishedAt.replace(/[^0-9TZ]/g, "-")}.png`;
}

/** Canvas only: no external images, private DOM capture, uploaded files or anonymous URLs. */
export async function renderLineupImage(source: PublishedImage, title: string, kickoffAt?: string | null): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot create an image. Try another browser.");
  const width = 1080;
  canvas.width = width;
  const wrap = (text: string, maxWidth: number, size: number): string[] => {
    ctx.font = `${size}px Arial, sans-serif`;
    const lines: string[] = [];
    let line = "";
    // Character wrapping also handles very long names without spaces.
    for (const char of text) {
      if (line && ctx.measureText(line + char).width > maxWidth) {
        lines.push(line.trimEnd()); line = "";
      }
      line += char;
    }
    if (line) lines.push(line.trimEnd());
    return lines.length ? lines : [""];
  };
  const titleLines = wrap(title, 960, 48);
  const pitch = source.board.players.filter((p) => p.area === "pitch");
  const bench = source.board.players.filter((p) => p.area === "bench");
  const label = (p: LineupBoard["players"][number]) =>
    `${p.shirtNumber == null ? "No number" : `#${p.shirtNumber}`}  ${p.name}${p.status === "maybe" ? " · Maybe (provisional)" : ""}`;
  const roster = (players: typeof pitch) => players.flatMap((p) => wrap(label(p), 944, 32));
  const pitchLines = roster(pitch);
  const benchLines = roster(bench);
  const fieldTop = 240 + titleLines.length * 58 + (kickoffAt ? 40 : 0);
  const fieldX = 100, fieldW = 880, fieldH = Math.round(fieldW * 91.4 / 55);
  const rosterTop = fieldTop + fieldH + 72;
  canvas.height = rosterTop + 210 + (pitchLines.length + Math.max(1, benchLines.length)) * 44;
  // Resizing resets context state.
  const text = (value: string, x: number, y: number, size = 32, color = "#183457", bold = false) => {
    ctx.font = `${bold ? "700 " : ""}${size}px Arial, sans-serif`;
    ctx.fillStyle = color; ctx.textAlign = "left"; ctx.fillText(value, x, y);
  };
  ctx.fillStyle = "#f1f5fa"; ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = "#183457"; ctx.fillRect(0, 0, width, fieldTop - 48);
  text("HK MASTERS HOCKEY · PUBLISHED LINEUP", 60, 62, 26, "#fbd36b", true);
  titleLines.forEach((line, i) => text(line, 60, 130 + i * 58, 48, "#ffffff", true));
  let y = 130 + titleLines.length * 58;
  if (kickoffAt) { text(`${hkFull(kickoffAt)} HKT`, 60, y, 28, "#ffffff"); y += 40; }
  text(`Published ${hkFull(source.publishedAt)} HKT`, 60, y, 28, "#ffffff");
  text(`${source.board.formation} · ${pitch.length}/11 on pitch${pitch.length < 11 ? " · Incomplete XI" : ""} · Attacking ↑`, 60, fieldTop - 12, 28, "#183457", true);
  ctx.save();
  ctx.translate(fieldX, fieldTop);
  ctx.scale(fieldW / 55, fieldH / 91.4);
  ctx.fillStyle = "#21578d"; ctx.fillRect(0, 0, 55, 91.4);
  ctx.strokeStyle = "#dceaf4"; ctx.lineWidth = 0.3;
  ctx.strokeRect(0.2, 0.2, 54.6, 91);
  for (const ly of [22.9, 45.7, 68.5]) {
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(55, ly); ctx.stroke();
  }
  for (const top of [true, false]) {
    const gy = top ? 0 : 91.4, direction = top ? 1 : -1;
    for (const r of [14.63, 19.63]) {
      ctx.setLineDash(r === 19.63 ? [1.1, 1.1] : []);
      const path = new Path2D(`M${25.67 - r} ${gy} A${r} ${r} 0 0 ${top ? 0 : 1} 25.67 ${gy + direction * r} L29.33 ${gy + direction * r} A${r} ${r} 0 0 ${top ? 0 : 1} ${29.33 + r} ${gy}`);
      ctx.stroke(path);
    }
  }
  ctx.restore();
  for (const p of pitch) {
    const x = fieldX + Math.max(5, Math.min(95, p.x)) / 100 * fieldW;
    const py = fieldTop + Math.max(4, Math.min(96, p.y)) / 100 * fieldH;
    ctx.beginPath(); ctx.arc(x, py, 31, 0, Math.PI * 2);
    ctx.fillStyle = "#fff9e8"; ctx.fill();
    ctx.strokeStyle = p.status === "maybe" ? "#ffc844" : "#183457";
    ctx.lineWidth = 5; ctx.setLineDash(p.status === "maybe" ? [8, 5] : []); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = "700 30px Arial, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#183457";
    ctx.fillText(String(p.shirtNumber ?? "–"), x, py + 10);
    const shortName = p.name.trim().split(/\s+/).at(-1) ?? p.name;
    ctx.font = "700 25px Arial, sans-serif";
    const nameWidth = Math.min(240, ctx.measureText(shortName).width + 16);
    const nx = Math.max(fieldX + nameWidth / 2, Math.min(fieldX + fieldW - nameWidth / 2, x));
    ctx.fillStyle = "#102b49"; ctx.fillRect(nx - nameWidth / 2, py + 36, nameWidth, 34);
    ctx.fillStyle = "#ffffff"; ctx.fillText(shortName, nx, py + 62, 224);
    if (p.status === "maybe") {
      ctx.fillStyle = "#ffe4a0"; ctx.fillRect(nx - 46, py + 72, 92, 30);
      ctx.fillStyle = "#613c00"; ctx.font = "700 22px Arial, sans-serif"; ctx.fillText("Maybe", nx, py + 95);
    }
  }
  y = rosterTop;
  text("ON PITCH · FULL NAMES", 60, y, 28, "#183457", true); y += 48;
  for (const line of pitchLines) { text(line, 68, y); y += 44; }
  y += 22;
  text(`SUBSTITUTES · ${bench.length}`, 60, y, 28, "#183457", true); y += 48;
  for (const line of benchLines.length ? benchLines : ["None named."]) { text(line, 68, y); y += 44; }
  text("Maybe = provisional · Published snapshot only", 60, y + 40, 26, "#52647c");
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Could not create the PNG. Please try again.")), "image/png",
  ));
}
