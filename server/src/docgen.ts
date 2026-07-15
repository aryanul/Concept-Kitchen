// PDF generator for exit / relieving documents.
//
// Renders a configurable letter or settlement sheet with pdf-lib (pure JS, works
// on Render). Everything visual — letterhead image, body text, signatory,
// footer, accent colour — comes from the caller's template + org profile, so HR
// controls the output entirely from Settings. Placeholders in the body are
// resolved against the exit-case context.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from 'pdf-lib';

export type OrgProfile = {
  companyName?: string; addressLine?: string; city?: string;
  logoUrl?: string; email?: string; phone?: string;
};

export type DocTemplate = {
  doc_type: string;
  title: string;
  show_letterhead: number;
  letterhead_url: string | null;
  body_template: string | null;
  signatory_name: string | null;
  signatory_designation: string | null;
  signature_url: string | null;
  footer_text: string | null;
  accent_color: string;
};

export type DocContext = Record<string, string>;

export type SettlementData = {
  earnings: Array<{ label: string; amount: number }>;
  deductions: Array<{ label: string; amount: number }>;
  gross: number; deductionsTotal: number; net: number;
};

// Helvetica (WinAnsi) can't encode the rupee sign or non-latin glyphs — keep the
// PDF text safe so a stray character never throws mid-render.
function safe(text: string): string {
  return (text ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '');
}
const money = (n: number) => `Rs. ${(Number(n) || 0).toLocaleString('en-IN')}`;

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return rgb(0.12, 0.16, 0.22);
  const int = parseInt(m[1], 16);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

export function resolvePlaceholders(template: string, ctx: DocContext): string {
  return (template || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key) => ctx[key] ?? '');
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) { out.push(line); line = word; }
      else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

async function embedImage(doc: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('png') || /\.png(\?|#|$)/i.test(url)) return await doc.embedPng(bytes);
    return await doc.embedJpg(bytes);
  } catch { return null; }
}

export async function generateDocumentPdf(opts: {
  template: DocTemplate;
  org: OrgProfile;
  ctx: DocContext;
  settlement?: SettlementData;
}): Promise<Uint8Array> {
  const { template, org, ctx, settlement } = opts;
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.12, 0.16);
  const muted = rgb(0.42, 0.45, 0.5);
  const accent = hexToRgb(template.accent_color);

  const { width, height } = page.getSize();
  const margin = 56;
  const contentWidth = width - margin * 2;
  let y = height - margin;

  // ── Header / letterhead ──────────────────────────────────────────────────
  if (template.show_letterhead && template.letterhead_url) {
    const img = await embedImage(doc, template.letterhead_url);
    if (img) {
      const w = contentWidth;
      const h = (img.height / img.width) * w;
      const drawH = Math.min(h, 110);
      const drawW = (img.width / img.height) * drawH;
      page.drawImage(img, { x: margin, y: y - drawH, width: Math.min(drawW, contentWidth), height: drawH });
      y -= drawH + 18;
    }
  } else {
    // Text letterhead from org profile
    if (org.logoUrl) {
      const logo = await embedImage(doc, org.logoUrl);
      if (logo) { const s = 44; page.drawImage(logo, { x: margin, y: y - s, width: (logo.width / logo.height) * s, height: s }); }
    }
    if (org.companyName) { page.drawText(safe(org.companyName), { x: margin + (org.logoUrl ? 56 : 0), y: y - 16, size: 16, font: bold, color: accent }); }
    const sub = [org.addressLine, org.city].filter(Boolean).join(', ');
    if (sub) page.drawText(safe(sub), { x: margin + (org.logoUrl ? 56 : 0), y: y - 32, size: 9, font, color: muted });
    y -= 54;
  }

  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: accent });
  y -= 26;

  // ── Date + Title ─────────────────────────────────────────────────────────
  page.drawText(safe(ctx.today ?? ''), { x: width - margin - font.widthOfTextAtSize(ctx.today ?? '', 10), y, size: 10, font, color: muted });
  y -= 24;
  const title = safe(template.title || 'Document');
  page.drawText(title, { x: (width - bold.widthOfTextAtSize(title, 17)) / 2, y, size: 17, font: bold, color: ink });
  y -= 30;

  // ── Body ─────────────────────────────────────────────────────────────────
  const body = safe(resolvePlaceholders(template.body_template || '', ctx));
  for (const line of wrap(body, font, 11, contentWidth)) {
    if (y < margin + 140) break;
    if (line) page.drawText(line, { x: margin, y, size: 11, font, color: ink });
    y -= line ? 16 : 10;
  }

  // ── Settlement table ─────────────────────────────────────────────────────
  if (settlement) {
    y -= 12;
    const rightX = width - margin;
    const drawRow = (label: string, amount: string, opt: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
      const f = opt.bold ? bold : font;
      page.drawText(safe(label), { x: margin, y, size: 10.5, font: f, color: opt.color ?? ink });
      const amtW = f.widthOfTextAtSize(amount, 10.5);
      page.drawText(amount, { x: rightX - amtW, y, size: 10.5, font: f, color: opt.color ?? ink });
      y -= 17;
    };
    page.drawText('EARNINGS', { x: margin, y, size: 9.5, font: bold, color: accent }); y -= 16;
    for (const e of settlement.earnings) drawRow(e.label, money(e.amount));
    y -= 4;
    drawRow('Gross Earnings', money(settlement.gross), { bold: true });
    y -= 10;
    page.drawText('DEDUCTIONS', { x: margin, y, size: 9.5, font: bold, color: accent }); y -= 16;
    for (const d of settlement.deductions) drawRow(d.label, money(d.amount));
    y -= 4;
    drawRow('Total Deductions', money(settlement.deductionsTotal), { bold: true });
    y -= 8;
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: rightX, y: y + 4 }, thickness: 1, color: accent });
    y -= 8;
    drawRow('NET PAYABLE', money(settlement.net), { bold: true, color: accent });
  }

  // ── Signatory ────────────────────────────────────────────────────────────
  let sigY = margin + 96;
  if (template.signature_url) {
    const sig = await embedImage(doc, template.signature_url);
    if (sig) { const h = 40; page.drawImage(sig, { x: margin, y: sigY, width: (sig.width / sig.height) * h, height: h }); }
  }
  sigY -= 6;
  if (template.signatory_name) { page.drawText(safe(template.signatory_name), { x: margin, y: sigY, size: 11, font: bold, color: ink }); sigY -= 15; }
  if (template.signatory_designation) { page.drawText(safe(template.signatory_designation), { x: margin, y: sigY, size: 9.5, font, color: muted }); }
  const company = org.companyName ? safe(org.companyName) : '';
  if (company) page.drawText(company, { x: margin, y: sigY - 14, size: 9.5, font, color: muted });

  // ── Footer ───────────────────────────────────────────────────────────────
  if (template.footer_text) {
    const ft = safe(template.footer_text);
    page.drawText(ft, { x: (width - font.widthOfTextAtSize(ft, 8)) / 2, y: margin - 18, size: 8, font, color: muted });
  }

  return doc.save();
}
