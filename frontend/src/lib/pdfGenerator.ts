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

/* ─── Font Registration ─────────────────────────────────────────── */
let fontsLoaded = false;

async function loadAndRegisterFonts(doc: jsPDF): Promise<void> {
  if (fontsLoaded) {
    doc.setFont('Roboto', 'normal');
    return;
  }

  try {
    // Fetch Roboto Regular & Bold TTF from public/fonts/
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

    // Convert ArrayBuffer → base64 string
    const regularB64 = arrayBufferToBase64(regularBuf);
    const boldB64 = arrayBufferToBase64(boldBuf);

    // Register fonts with jsPDF VFS
    doc.addFileToVFS('Roboto-Regular.ttf', regularB64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    doc.addFileToVFS('Roboto-Bold.ttf', boldB64);
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

    fontsLoaded = true;
    doc.setFont('Roboto', 'normal');
  } catch (err) {
    console.warn('Roboto font yuklenemedi, fallback helvetica kullanilacak:', err);
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
    case 'FEMALE': return 'Kadin';
    case 'OTHER': return 'Diger';
    default: return g;
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case 'DRAFT': return 'TASLAK';
    case 'REVIEW_NEEDED': return 'INCELEME BEKLIYOR';
    case 'APPROVED': return 'ONAYLANDI';
    default: return s;
  }
}

/* ─── Word-wrap text into lines ──────────────────────────────────── */
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text) return ['-'];
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('');
      continue;
    }
    const wrapped = doc.splitTextToSize(para, maxWidth) as string[];
    lines.push(...wrapped);
  }
  return lines;
}

/* ─── Draw a horizontal ruled line ───────────────────────────────── */
function drawRule(doc: jsPDF, y: number, leftX: number, rightX: number, color = COLORS.borderLight) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.3);
  doc.line(leftX, y, rightX, y);
}

/* ─── Page check / auto-add ──────────────────────────────────────── */
function ensureSpace(doc: jsPDF, currentY: number, needed: number, margin: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + needed > pageHeight - margin) {
    doc.addPage();
    return margin + 10;
  }
  return currentY;
}

/* ─── Font setter helpers (Roboto with fallback) ─────────────────── */
function setFont(doc: jsPDF, style: 'normal' | 'bold' | 'italic' = 'normal') {
  try {
    if (style === 'italic') {
      // Roboto italic not loaded — use normal
      doc.setFont('Roboto', 'normal');
    } else {
      doc.setFont('Roboto', style);
    }
  } catch {
    doc.setFont('helvetica', style);
  }
}

/* ─── Main PDF Generator (async for font loading) ────────────────── */
export async function generateMriReportPdf(report: ReportData, patient: PatientInfo | null): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // ─── Load & Register Turkish-compatible Roboto font ─────────────
  await loadAndRegisterFonts(doc);

  // ─── Header Banner ──────────────────────────────────────────────
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Header accent stripe
  doc.setFillColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  doc.rect(0, 38, pageWidth, 2, 'F');

  // Hospital logo area (circle)
  doc.setFillColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.circle(margin + 10, 19, 8, 'F');
  doc.setFontSize(14);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  setFont(doc, 'bold');
  doc.text('MC', margin + 10, 21.5, { align: 'center' });

  // Title text
  doc.setFontSize(18);
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  setFont(doc, 'bold');
  doc.text('MediCopilot', margin + 24, 16);

  doc.setFontSize(8.5);
  setFont(doc, 'normal');
  doc.setTextColor(200, 210, 230);
  doc.text('MR Radyoloji Raporu', margin + 24, 23);

  // Report metadata right side
  doc.setFontSize(7.5);
  doc.setTextColor(200, 210, 230);
  setFont(doc, 'normal');
  const reportIdShort = report.id.length > 12 ? report.id.slice(0, 12) + '...' : report.id;
  doc.text('Rapor ID: ' + reportIdShort, pageWidth - margin, 13, { align: 'right' });
  doc.text('Tarih: ' + formatDateTR(report.createdAt), pageWidth - margin, 18.5, { align: 'right' });
  doc.text('Durum: ' + statusLabel(report.status), pageWidth - margin, 24, { align: 'right' });

  y = 48;

  // ─── Patient Information Table ──────────────────────────────────
  doc.setFontSize(10);
  setFont(doc, 'bold');
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('HASTA BILGILERI', margin, y);
  y += 2;

  // Horizontal divider
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(margin, y, contentWidth, 0.6, 'F');
  y += 4;

  // Patient table
  const tableStartY = y;
  const rowHeight = 8;

  // Build patient data rows — handle both found & fallback patient
  const patientId = patient?.id || report.patientId || '-';
  const nationalId = patient?.nationalId || '-';
  const firstName = patient?.firstName || '-';
  const lastName = patient?.lastName || '-';
  const dob = formatDateOnly(patient?.dateOfBirth);
  const gender = genderLabel(patient?.gender);

  const rows = [
    ['Hasta ID', patientId],
    ['TC Kimlik No', nationalId],
    ['Ad', firstName],
    ['Soyad', lastName],
    ['Dogum Tarihi', dob],
    ['Cinsiyet', gender],
  ];

  const labelColWidth = 40;
  const valueColWidth = contentWidth - labelColWidth;

  rows.forEach((row, idx) => {
    const rowY = tableStartY + idx * rowHeight;

    // Alternating row background
    if (idx % 2 === 0) {
      doc.setFillColor(COLORS.lightBg[0], COLORS.lightBg[1], COLORS.lightBg[2]);
    } else {
      doc.setFillColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    }
    doc.rect(margin, rowY, contentWidth, rowHeight, 'F');

    // Cell borders
    doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
    doc.setLineWidth(0.2);
    doc.rect(margin, rowY, labelColWidth, rowHeight, 'S');
    doc.rect(margin + labelColWidth, rowY, valueColWidth, rowHeight, 'S');

    // Label text
    doc.setFontSize(8.5);
    setFont(doc, 'bold');
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.text(row[0], margin + 3, rowY + 5.5);

    // Value text
    setFont(doc, 'normal');
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.text(row[1], margin + labelColWidth + 3, rowY + 5.5);
  });

  y = tableStartY + rows.length * rowHeight + 10;

  // ─── Doctor Report/Opinion Section (doctorFinalText ONLY) ───────
  y = ensureSpace(doc, y, 30, margin);

  doc.setFontSize(10);
  setFont(doc, 'bold');
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('Doktor Raporu', margin, y);
  y += 2;

  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(margin, y, contentWidth, 0.4, 'F');
  y += 5;

  if (report.doctorFinalText) {
    // Doctor verified badge
    doc.setFillColor(230, 245, 238);
    doc.roundedRect(margin, y - 1, contentWidth, 6, 1.5, 1.5, 'F');
    doc.setFontSize(7);
    setFont(doc, 'normal');
    doc.setTextColor(COLORS.success[0], COLORS.success[1], COLORS.success[2]);
    doc.text('Bu metin doktor tarafindan incelenmis ve onaylanmistir.', margin + 3, y + 2.5);
    y += 9;

    const doctorLines = wrapText(doc, report.doctorFinalText, contentWidth - 6);
    doc.setFontSize(9);
    setFont(doc, 'normal');
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);

    for (const line of doctorLines) {
      y = ensureSpace(doc, y, 6, margin);
      doc.text(line, margin + 3, y);
      y += 4.5;
    }
  } else {
    doc.setFontSize(8.5);
    setFont(doc, 'normal');
    doc.setTextColor(COLORS.lightText[0], COLORS.lightText[1], COLORS.lightText[2]);
    doc.text('Henuz doktor tarafindan onaylanmamistir.', margin + 3, y);
    y += 6;
  }

  // ─── Footer ────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer line
    drawRule(doc, pageHeight - 18, margin, pageWidth - margin, COLORS.borderLight);

    // Footer text
    doc.setFontSize(6.5);
    setFont(doc, 'normal');
    doc.setTextColor(COLORS.lightText[0], COLORS.lightText[1], COLORS.lightText[2]);
    doc.text('MediCopilot - Event-Driven Dual-Agent Radiology AI System', margin, pageHeight - 13);
    doc.text('Bu rapor yapay zeka destekli olarak uretilmistir. Doktor onayi olmadan gecerli degildir.', margin, pageHeight - 9.5);
    doc.text('Sayfa ' + i + ' / ' + totalPages, pageWidth - margin, pageHeight - 13, { align: 'right' });
    doc.text('Olusturulma: ' + new Date().toLocaleString('tr-TR'), pageWidth - margin, pageHeight - 9.5, { align: 'right' });

    // Bottom accent stripe
    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.rect(0, pageHeight - 4, pageWidth, 4, 'F');
  }

  // ─── Download ──────────────────────────────────────────────────
  const fileName = 'MediCopilot_MR_Rapor_' + report.patientId + '_' + report.id.slice(-6).toUpperCase() + '.pdf';
  doc.save(fileName);
}
