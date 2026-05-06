import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText, User, Clock, Brain, CheckCircle2, AlertTriangle,
  FilePlus2, Loader2, X, PenLine, Bot, ChevronRight, RefreshCw,
  Eye, Download
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAppStore } from '@/store/useAppStore';
import { generateMriReportPdf } from '@/lib/pdfGenerator';

/* ─── Types ──────────────────────────────────────────────────────── */
interface Report {
  id: string;
  patientId: string;
  doctorId: string | null;
  imagePath: string;
  aiDraftText: string | null;
  aiConfidenceScore: number | null;
  doctorFinalText: string | null;
  status: 'DRAFT' | 'REVIEW_NEEDED' | 'APPROVED';
  createdAt: string | null;
  updatedAt: string | null;
}

interface PatientInfo {
  id: string;
  nationalId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  fullName?: string | null;
}

type TabKey = 'all' | 'mine';

/* ─── Status Badge ───────────────────────────────────────────────── */
const statusConfig: Record<Report['status'], { label: string; color: string; bgClass: string; borderClass: string; icon: React.ReactNode }> = {
  DRAFT: {
    label: 'Taslak',
    color: 'text-slate-400',
    bgClass: 'bg-slate-500/10',
    borderClass: 'border-slate-500/25',
    icon: <FilePlus2 className="w-3 h-3" />,
  },
  REVIEW_NEEDED: {
    label: 'İnceleme Bekliyor',
    color: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/25',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  APPROVED: {
    label: 'Onaylandı',
    color: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/25',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
};

function StatusBadge({ status }: { status: Report['status'] }) {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${cfg.color} ${cfg.bgClass} ${cfg.borderClass}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

/* ─── Confidence Bar ─────────────────────────────────────────────── */
function ConfidenceBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-slate-600">—</span>;

  const pct = Math.round(score * 100);
  const barColor =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 60 ? 'bg-amber-500' :
    'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-400 tabular-nums w-10 text-right">{pct}%</span>
    </div>
  );
}

/* ─── Date Formatter ─────────────────────────────────────────────── */
function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    // Guard against epoch-0 / invalid dates
    if (isNaN(d.getTime()) || d.getTime() < 86400000) return '—';
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return '—';
  }
}

/* ─── Report Detail Modal ────────────────────────────────────────── */
interface DetailModalProps {
  report: Report;
  onClose: () => void;
  onApproved: () => void;
}

function ReportDetailModal({ report, onClose, onApproved }: DetailModalProps) {
  const [editedText, setEditedText] = useState(report.aiDraftText || '');
  const [isEdited, setIsEdited] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const canApprove = report.status === 'REVIEW_NEEDED';

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setEditedText(v);
    setIsEdited(v !== (report.aiDraftText || ''));
  }, [report.aiDraftText]);

  const handleApprove = async () => {
    if (!editedText.trim()) return;
    setIsApproving(true);
    try {
      await axios.put(`/api/v1/reports/${report.id}`, {
        doctorFinalText: editedText,
        status: 'APPROVED',
      });
      toast.success('Rapor başarıyla onaylandı!');
      onApproved();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Onaylama sırasında hata oluştu.');
      setIsApproving(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      // Fetch patient info for the PDF
      let patient: PatientInfo | null = null;
      try {
        const patientRes = await axios.get(`/api/v1/patients/${report.patientId}`);
        if (patientRes.data?.success && patientRes.data?.data) {
          patient = patientRes.data.data;
        }
      } catch {
        // If patient fetch fails, continue with null (will show IDs only)
        console.warn('Patient info could not be loaded for PDF.');
      }

      await generateMriReportPdf(report, patient);
      toast.success('PDF başarıyla oluşturuldu ve indirildi!');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast.error('PDF oluşturulurken bir hata oluştu.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Image URL — use the backend resource endpoint (report ID based)
  const imageSrc = report.id ? `/api/v1/mri/view/${report.id}` : null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Modal Content */}
        <motion.div
          className="relative w-full max-w-6xl max-h-[90vh] bg-slate-900 border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-800/60 bg-slate-900/95 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Rapor Detayı</h2>
                <p className="text-xs text-slate-500 font-medium">ID: {report.id.slice(0, 12)}... · Hasta: {report.patientId}</p>
              </div>
              <StatusBadge status={report.status} />
            </div>
            <div className="flex items-center gap-2">
              {/* Download PDF Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300 hover:border-blue-400/50 rounded-xl h-10 px-4 gap-2 transition-all"
                id="download-pdf-button"
              >
                {isDownloadingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-semibold">Oluşturuluyor...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span className="text-xs font-semibold">PDF İndir</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl h-10 w-10"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left: MR Image */}
            <div className="w-[50%] bg-slate-950 flex items-center justify-center p-6 border-r border-slate-800/40">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="MR Görüntüsü"
                  className="max-w-full max-h-[65vh] object-contain rounded-xl opacity-90"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex flex-col items-center text-slate-600 gap-3">
                  <FileText className="w-16 h-16 opacity-30" />
                  <span className="text-sm">Görüntü yüklenemedi</span>
                </div>
              )}
            </div>

            {/* Right: Report Content */}
            <div className="w-[50%] flex flex-col p-6 overflow-y-auto">
              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-800/40">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Hasta ID</p>
                  <p className="text-sm font-semibold text-slate-200">{report.patientId}</p>
                </div>
                <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-800/40">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">AI Güven Skoru</p>
                  <ConfidenceBar score={report.aiConfidenceScore} />
                </div>
                <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-800/40">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Oluşturulma</p>
                  <p className="text-xs font-medium text-slate-300">{formatDate(report.createdAt)}</p>
                </div>
                <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-800/40">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Son Güncelleme</p>
                  <p className="text-xs font-medium text-slate-300">{formatDate(report.updatedAt)}</p>
                </div>
              </div>

              {/* AI Draft Section */}
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {canApprove ? 'AI Taslağı (Düzenlenebilir)' : 'AI Taslak Metni'}
                </span>
                {canApprove && isEdited && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-semibold">
                    Değiştirildi
                  </span>
                )}
              </div>

              {canApprove ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <PenLine className="w-3 h-3 text-primary/50" />
                    <span className="text-[11px] text-slate-500">Düzenleyip onaylayabilirsiniz</span>
                  </div>
                  <textarea
                    value={editedText}
                    onChange={handleTextChange}
                    className="flex-1 w-full rounded-xl border border-primary/25 bg-slate-950/50 px-4 py-3 text-sm resize-none font-mono leading-relaxed text-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
                    style={{ minHeight: '180px' }}
                  />
                </>
              ) : (
                <div className="flex-1 rounded-xl border border-slate-800/40 bg-slate-950/30 px-4 py-3 text-sm font-mono leading-relaxed text-slate-400 overflow-y-auto whitespace-pre-wrap" style={{ minHeight: '120px' }}>
                  {report.aiDraftText || '—'}
                </div>
              )}

              {/* Doctor Final Text (only if APPROVED) */}
              {report.status === 'APPROVED' && report.doctorFinalText && (
                <div className="mt-5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider">Doktor Onaylı Metin</span>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm font-mono leading-relaxed text-slate-300 overflow-y-auto whitespace-pre-wrap" style={{ maxHeight: '150px' }}>
                    {report.doctorFinalText}
                  </div>
                </div>
              )}

              {/* Approve Button */}
              {canApprove && (
                <div className="mt-5 shrink-0">
                  <Button
                    className="w-full h-14 text-base font-semibold rounded-xl shadow-xl hover:shadow-primary/20 hover:scale-[1.005] transition-all"
                    disabled={isApproving || !editedText.trim()}
                    onClick={handleApprove}
                  >
                    {isApproving ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Kaydediliyor...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        İnceledim ve Onaylıyorum
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Report Card ────────────────────────────────────────────────── */
function ReportCard({ report, onSelect }: { report: Report; onSelect: (r: Report) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
    >
      <Card
        className="group bg-slate-900/60 border-slate-800/60 hover:border-slate-700/80 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer backdrop-blur-sm rounded-2xl overflow-hidden"
        onClick={() => onSelect(report)}
      >
        <CardContent className="p-5">
          {/* Top Row: Patient + Status */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/15 shrink-0">
                <User className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-100 tracking-tight">{report.patientId}</p>
                <p className="text-[11px] text-slate-500 font-medium">Rapor #{report.id.slice(-6).toUpperCase()}</p>
              </div>
            </div>
            <StatusBadge status={report.status} />
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-3.5 h-3.5 shrink-0 text-slate-500" />
              <span className="text-xs font-medium truncate">{formatDate(report.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Brain className="w-3.5 h-3.5 shrink-0 text-slate-500" />
              <span className="text-xs font-medium">AI Güven:</span>
            </div>
          </div>

          {/* Confidence Bar */}
          <ConfidenceBar score={report.aiConfidenceScore} />

          {/* View Hint */}
          <div className="mt-4 pt-3 border-t border-slate-800/40 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">
              {report.aiDraftText ? 'AI raporu mevcut' : 'Analiz bekleniyor...'}
            </span>
            <div className="flex items-center gap-1 text-primary/60 group-hover:text-primary transition-colors">
              <Eye className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Detay</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Main ReportsView ───────────────────────────────────────────── */
export function ReportsView() {
  const { doctorId, doctorName } = useAppStore();
  const [tab, setTab] = useState<TabKey>('all');
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = tab === 'mine' && doctorId
        ? `/api/v1/reports/doctor/${doctorId}`
        : '/api/v1/reports';
      const res = await axios.get(url);
      const data: Report[] = res.data?.data || [];
      // Sort by createdAt descending (newest first), null-safe
      data.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      setReports(data);
    } catch (err: any) {
      console.error('Report fetch error:', err);
      toast.error('Raporlar yüklenirken bir hata oluştu.');
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, [tab, doctorId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleApproved = () => {
    setSelectedReport(null);
    fetchReports(); // Refresh list
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'Tüm Raporlar', icon: <FileText className="w-4 h-4" /> },
    { key: 'mine', label: 'Raporlarım', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Rapor Merkezi</h1>
          <p className="text-sm text-slate-500 mt-1">
            {doctorName ? `Dr. ${doctorName}` : 'Hoş geldiniz'} · {reports.length} rapor listeleniyor
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchReports}
          disabled={isLoading}
          className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl h-10 w-10"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-slate-900/60 border border-slate-800/60 rounded-2xl mb-8 w-fit backdrop-blur-sm">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
              ${tab === t.key
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <span className="text-sm font-medium">Raporlar yükleniyor...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
          <FileText className="w-12 h-12 opacity-20" />
          <p className="text-sm font-medium">
            {tab === 'mine' ? 'Henüz size ait rapor bulunmuyor.' : 'Henüz rapor oluşturulmamış.'}
          </p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          layout
        >
          <AnimatePresence mode="popLayout">
            {reports.map(r => (
              <ReportCard key={r.id} report={r} onSelect={setSelectedReport} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onApproved={handleApproved}
        />
      )}
    </div>
  );
}
