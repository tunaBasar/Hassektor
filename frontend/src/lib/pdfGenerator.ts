import { jsPDF } from 'jspdf';

/* ─── Types ──────────────────────────────────────────────────────── */
interface PatientInfo {
  id: string;
  nationalId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  fullName?: string | null;
}

interface ReportData {
  id: string;
  patientId: string;
  doctorId: string | null;
  aiDraftText: string | null;
  aiConfidenceScore: number | null;
  doctorFinalText: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

/* ─── Color Palette ──────────────────────────────────────────────── */
const COLORS = {
  primary: [30, 64, 124] as [number, number, number],
  secondary: [52, 100, 166] as [number, number, number],
  accent: [0, 128, 128] as [number, number, number],
  dark: [20, 24, 40] as [number, number, number],
  text: [33, 37, 41] as [number, number, number],
  lightText: [108, 117, 125] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightBg: [245, 247, 250] as [number, number, number],
  borderLight: [220, 225, 235] as [number, number, number],
  success: [25, 135, 84] as [number, number, number],
  warning: [255, 170, 0] as [number, number, number],
  danger: [220, 53, 69] as [number, number, number],
};

/* ─── Layout Constants ───────────────────────────────────────────── */
const MARGIN = 18;
const BODY_LINE_H = 4.5;       // mm per line of body text (font 9pt)
const SMALL_LINE_H = 3.5;      // mm per line of small text (font 7pt)
const TABLE_CELL_PAD_X = 3;    // horizontal padding inside table cells
const TABLE_CELL_PAD_Y = 2.5;  // vertical padding inside table cells
const FOOTER_RESERVED = 30;    // mm reserved at page bottom for footer

/* ─── Font Registration ─────────────────────────────────────────── */
let cachedRegularB64: string | null = null;
let cachedBoldB64: string | null = null;

async function loadAndRegisterFonts(doc: jsPDF): Promise<void> {
  try {
    if (!cachedRegularB64 || !cachedBoldB64) {
      const [regularRes, boldRes] = await Promise.all([
        fetch('/fonts/Roboto-Regular.ttf'),
        fetch('/fonts/Roboto-Bold.ttf'),
      ]);
      if (!regularRes.ok || !boldRes.ok) {
        throw new Error('Font files could not be fetched');
      }
      const [regularBuf, boldBuf] = await Promise.all([
        regularRes.arrayBuffer(),
        boldRes.arrayBuffer(),
      ]);
      cachedRegularB64 = arrayBufferToBase64(regularBuf);
      cachedBoldB64 = arrayBufferToBase64(boldBuf);
    }
    // Must register on EVERY jsPDF instance — fonts are instance-scoped
    doc.addFileToVFS('Roboto-Regular.ttf', cachedRegularB64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFileToVFS('Roboto-Bold.ttf', cachedBoldB64);
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
    doc.setFont('Roboto', 'normal');
  } catch (err) {
    console.warn('Roboto font yüklenemedi, fallback helvetica kullanılacak:', err);
    doc.setFont('helvetica', 'normal');
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function formatDateTR(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime()) || d.getTime() < 86400000) return '-';
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(d);
  } catch {
    return '-';
  }
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(d);
  } catch {
    return '-';
  }
}

function genderLabel(g: string | null | undefined): string {
  if (!g) return '-';
  switch (g.toUpperCase()) {
    case 'MALE': return 'Erkek';
    case 'FEMALE': return 'Kadın';
    case 'OTHER': return 'Diğer';
    default: return g;
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case 'DRAFT': return 'TASLAK';
    case 'REVIEW_NEEDED': return 'İNCELEME BEKLİYOR';
    case 'APPROVED': return 'ONAYLANDI';
    default: return s;
  }
}

/* ─────────────────────────────────────────────────────────────────────
 *  measureAndWrap — THE SINGLE wrapping function.
 *
 *  CRITICAL: jsPDF.splitTextToSize() measures glyph widths using the
 *  CURRENTLY ACTIVE font + size. If those aren't set before the call,
 *  the measurement is wrong and the text WILL overflow.
 *
 *  This function therefore EXPLICITLY sets the font + size before
 *  every call, making it impossible to get stale metrics.
 * ───────────────────────────────────────────────────────────────────── */
function measureAndWrap(
  doc: jsPDF,
  text: string,
  maxWidthMm: number,
  fontSize: number,
  fontStyle: 'normal' | 'bold' = 'normal',
): string[] {
  if (!text) return ['-'];

  // Lock font state before measuring
  doc.setFontSize(fontSize);
  try {
    doc.setFont('Roboto', fontStyle);
  } catch {
    doc.setFont('helvetica', fontStyle);
  }

  const result: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') {
      result.push('');
      continue;
    }
    // splitTextToSize returns string[] where each element fits within maxWidthMm
    const wrapped = doc.splitTextToSize(para, maxWidthMm) as string[];
    result.push(...wrapped);
  }
  return result;
}

/* ─── Draw a horizontal ruled line ───────────────────────────────── */
function drawRule(doc: jsPDF, y: number, x1: number, x2: number, color = COLORS.borderLight) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
}

/* ─── Page break check ───────────────────────────────────────────── */
function ensureSpace(doc: jsPDF, currentY: number, neededMm: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (currentY + neededMm > pageH - FOOTER_RESERVED) {
    doc.addPage();
    return MARGIN + 5;
  }
  return currentY;
}

/* ─── Font shorthand (sets on doc, returns nothing) ──────────────── */
function setFont(doc: jsPDF, style: 'normal' | 'bold' = 'normal') {
  try { doc.setFont('Roboto', style); }
  catch { doc.setFont('helvetica', style); }
}

/* ═══════════════════════════════════════════════════════════════════
 *  MAIN PDF GENERATOR
 * ═══════════════════════════════════════════════════════════════════ */
export async function generateMriReportPdf(
  report: ReportData,
  patient: PatientInfo | null,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();   // 210 mm
  const PH = doc.internal.pageSize.getHeight();  // 297 mm
  const CW = PW - MARGIN * 2;                    // 174 mm usable content width
  let y = 0;

  // Load & register Roboto TTF (Turkish-glyph-compatible)
  await loadAndRegisterFonts(doc);

  // ═══════════════════════════════════════════════════════════════
  //  HEADER BANNER (0 – 40 mm)
  // ═══════════════════════════════════════════════════════════════
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, PW, 38, 'F');
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 38, PW, 2, 'F');

  // Logo circle
  doc.setFillColor(...COLORS.white);
  doc.circle(MARGIN + 10, 19, 8, 'F');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary);
  setFont(doc, 'bold');
  doc.text('MC', MARGIN + 10, 21.5, { align: 'center' });

  // Title
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  setFont(doc, 'bold');
  doc.text('MediCopilot', MARGIN + 24, 16);
  doc.setFontSize(8.5);
  setFont(doc, 'normal');
  doc.setTextColor(200, 210, 230);
  doc.text('MR Radyoloji Raporu', MARGIN + 24, 23);

  // Right-side meta (wrapped within 55 mm so it can't overflow)
  const RIGHT_COL_MAX = 55;
  const reportIdShort = report.id.length > 12
    ? report.id.slice(0, 12) + '...'
    : report.id;

  const metaItems = [
    'Rapor ID: ' + reportIdShort,
    'Tarih: ' + formatDateTR(report.createdAt),
    'Durum: ' + statusLabel(report.status),
  ];
  let metaY = 13;
  for (const item of metaItems) {
    const lines = measureAndWrap(doc, item, RIGHT_COL_MAX, 7.5, 'normal');
    doc.setTextColor(200, 210, 230);
    for (const ln of lines) {
      doc.text(ln, PW - MARGIN, metaY, { align: 'right' });
      metaY += SMALL_LINE_H;
    }
  }

  y = 48;

  // ═══════════════════════════════════════════════════════════════
  //  PATIENT TABLE — dynamic row heights, text always wraps
  // ═══════════════════════════════════════════════════════════════
  doc.setFontSize(10);
  setFont(doc, 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('HASTA BİLGİLERİ', MARGIN, y);
  y += 2;
  doc.setFillColor(...COLORS.primary);
  doc.rect(MARGIN, y, CW, 0.6, 'F');
  y += 4;

  const LABEL_COL_W = 40;
  const VALUE_COL_W = CW - LABEL_COL_W;
  const LABEL_TEXT_W = LABEL_COL_W - TABLE_CELL_PAD_X * 2;   // 34 mm
  const VALUE_TEXT_W = VALUE_COL_W - TABLE_CELL_PAD_X * 2;   // 128 mm

  const pid = patient?.id || report.patientId || '-';
  const nid = patient?.nationalId || '-';
  const fname = patient?.firstName || '-';
  const lname = patient?.lastName || '-';
  const dob = formatDateOnly(patient?.dateOfBirth);
  const gen = genderLabel(patient?.gender);

  const rows: [string, string][] = [
    ['Hasta ID', pid],
    ['TC Kimlik No', nid],
    ['Ad', fname],
    ['Soyad', lname],
    ['Doğum Tarihi', dob],
    ['Cinsiyet', gen],
  ];

  const TABLE_FONT = 8.5;

  for (let i = 0; i < rows.length; i++) {
    const [label, value] = rows[i];

    // Wrap BOTH columns with font properly set before measurement
    const labelLines = measureAndWrap(doc, label, LABEL_TEXT_W, TABLE_FONT, 'bold');
    const valueLines = measureAndWrap(doc, value, VALUE_TEXT_W, TABLE_FONT, 'normal');

    const maxLines = Math.max(labelLines.length, valueLines.length);
    const rowH = Math.max(8, maxLines * BODY_LINE_H + TABLE_CELL_PAD_Y * 2);

    y = ensureSpace(doc, y, rowH);

    // Background
    doc.setFillColor(...(i % 2 === 0 ? COLORS.lightBg : COLORS.white));
    doc.rect(MARGIN, y, CW, rowH, 'F');

    // Borders
    doc.setDrawColor(...COLORS.borderLight);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, y, LABEL_COL_W, rowH, 'S');
    doc.rect(MARGIN + LABEL_COL_W, y, VALUE_COL_W, rowH, 'S');

    // Label text
    doc.setFontSize(TABLE_FONT);
    setFont(doc, 'bold');
    doc.setTextColor(...COLORS.dark);
    const baselineY = y + TABLE_CELL_PAD_Y + 3;
    for (let li = 0; li < labelLines.length; li++) {
      doc.text(labelLines[li], MARGIN + TABLE_CELL_PAD_X, baselineY + li * BODY_LINE_H);
    }

    // Value text
    doc.setFontSize(TABLE_FONT);
    setFont(doc, 'normal');
    doc.setTextColor(...COLORS.text);
    for (let vi = 0; vi < valueLines.length; vi++) {
      doc.text(valueLines[vi], MARGIN + LABEL_COL_W + TABLE_CELL_PAD_X, baselineY + vi * BODY_LINE_H);
    }

    y += rowH;
  }

  y += 10;

  // ═══════════════════════════════════════════════════════════════
  //  DOCTOR REPORT SECTION
  // ═══════════════════════════════════════════════════════════════
  y = ensureSpace(doc, y, 20);

  doc.setFontSize(10);
  setFont(doc, 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('Doktor Raporu', MARGIN, y);
  y += 2;
  doc.setFillColor(...COLORS.primary);
  doc.rect(MARGIN, y, CW, 0.4, 'F');
  y += 5;

  // The text block MUST stay within  [MARGIN + pad .. MARGIN + CW - pad]
  const TEXT_PAD = 3;
  const TEXT_MAX_W = CW - TEXT_PAD * 2;  // 168 mm

  if (report.doctorFinalText) {
    // ── Verified badge ──────────────────────────────────────────
    const badgeStr = 'Bu metin doktor tarafından incelenmiş ve onaylanmıştır.';
    const badgeLines = measureAndWrap(doc, badgeStr, TEXT_MAX_W, 7, 'normal');
    const badgeH = Math.max(6, badgeLines.length * SMALL_LINE_H + 3);

    y = ensureSpace(doc, y, badgeH + 4);
    doc.setFillColor(230, 245, 238);
    doc.roundedRect(MARGIN, y - 1, CW, badgeH, 1.5, 1.5, 'F');
    doc.setFontSize(7);
    setFont(doc, 'normal');
    doc.setTextColor(...COLORS.success);
    let by = y + 2.5;
    for (const bl of badgeLines) {
      doc.text(bl, MARGIN + TEXT_PAD, by);
      by += SMALL_LINE_H;
    }
    y += badgeH + 3;

    // ── Doctor final text body ──────────────────────────────────
    // measureAndWrap sets font 9pt normal BEFORE calling splitTextToSize
    const bodyLines = measureAndWrap(doc, report.doctorFinalText, TEXT_MAX_W, 9, 'normal');

    // Now keep font state in sync for rendering
    doc.setFontSize(9);
    setFont(doc, 'normal');
    doc.setTextColor(...COLORS.text);

    for (const line of bodyLines) {
      y = ensureSpace(doc, y, BODY_LINE_H + 2);
      doc.text(line, MARGIN + TEXT_PAD, y);
      y += BODY_LINE_H;
    }
  } else {
    // Placeholder — no report yet
    const phLines = measureAndWrap(
      doc,
      'Henüz doktor tarafından onaylanmamıştır.',
      TEXT_MAX_W, 8.5, 'normal',
    );
    doc.setTextColor(...COLORS.lightText);
    for (const pl of phLines) {
      y = ensureSpace(doc, y, BODY_LINE_H + 2);
      doc.text(pl, MARGIN + TEXT_PAD, y);
      y += BODY_LINE_H;
    }
    y += 2;
  }

  // ═══════════════════════════════════════════════════════════════
  //  FOOTER — every page, always within margins
  // ═══════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  const FOOTER_COL_W = CW / 2 - 2; // ~85 mm per footer column

  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);

    // Divider
    drawRule(doc, PH - 22, MARGIN, PW - MARGIN, COLORS.borderLight);

    // Left column
    const fl1 = measureAndWrap(doc, 'MediCopilot - Event-Driven Dual-Agent Radiology AI System', FOOTER_COL_W, 6.5, 'normal');
    const fl2 = measureAndWrap(doc, 'Bu rapor yapay zekâ destekli olarak üretilmiştir. Doktor onayı olmadan geçerli değildir.', FOOTER_COL_W, 6.5, 'normal');
    doc.setFontSize(6.5);
    setFont(doc, 'normal');
    doc.setTextColor(...COLORS.lightText);

    let flY = PH - 19;
    for (const l of fl1) { doc.text(l, MARGIN, flY); flY += 3; }
    flY += 0.5;
    for (const l of fl2) { doc.text(l, MARGIN, flY); flY += 3; }

    // Right column
    const fr1 = measureAndWrap(doc, 'Sayfa ' + pg + ' / ' + totalPages, FOOTER_COL_W, 6.5, 'normal');
    const fr2 = measureAndWrap(doc, 'Oluşturulma: ' + new Date().toLocaleString('tr-TR'), FOOTER_COL_W, 6.5, 'normal');

    let frY = PH - 19;
    for (const l of fr1) { doc.text(l, PW - MARGIN, frY, { align: 'right' }); frY += 3; }
    frY += 0.5;
    for (const l of fr2) { doc.text(l, PW - MARGIN, frY, { align: 'right' }); frY += 3; }

    // Bottom stripe
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, PH - 4, PW, 4, 'F');
  }

  // ═══════════════════════════════════════════════════════════════
  //  DOWNLOAD
  // ═══════════════════════════════════════════════════════════════
  const fileName =
    'MediCopilot_MR_Rapor_' +
    report.patientId + '_' +
    report.id.slice(-6).toUpperCase() + '.pdf';
  doc.save(fileName);
}
