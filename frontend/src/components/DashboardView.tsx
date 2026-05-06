import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Bot, Loader2, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAppStore } from '@/store/useAppStore';

interface DashboardViewProps {
  file: File;
  onApprove: () => void;
}

const AudioWaveform = () => (
  <div className="flex items-center gap-1 h-6 ml-4">
    <span className="text-xs text-primary/80 mr-2 font-medium tracking-wider">AI ANALİZ EDİYOR</span>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <motion.div
        key={i}
        className="w-1 bg-primary rounded-full"
        animate={{ height: ["30%", "100%", "40%", "80%", "30%"] }}
        transition={{ duration: Math.random() * 0.5 + 0.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }}
      />
    ))}
  </div>
);

export function DashboardView({ file, onApprove }: DashboardViewProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [typewriterComplete, setTypewriterComplete] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isEdited, setIsEdited] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { reportId, analysisStatus, setAnalysisStatus, aiDraftText, setAiDraftText, resetStore } = useAppStore();

  const isScanning = analysisStatus === 'SCANNING';
  const isReady = analysisStatus === 'READY';

  // Dosya URL'si
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Rapor hazır olduğunda çağrılacak ortak fonksiyon
  const handleReportReady = async (source: string) => {
    if (!reportId) return;
    console.log(`[${source}] Rapor hazır sinyali alındı, REST API'den çekiliyor...`);
    toast.success("Yapay Zeka Raporu Hazır!", {
      className: 'bg-green-600 text-white border-none'
    });

    try {
      const res = await axios.get(`/api/v1/reports/${reportId}`);
      const report = res.data?.data;
      console.log(`[${source}] API yanıtı:`, { status: report?.status, hasAiText: !!report?.aiDraftText });
      if (report?.aiDraftText) {
        setAiDraftText(report.aiDraftText);
      }
    } catch (fetchErr) {
      console.error(`[${source}] Report fetch error:`, fetchErr);
    }

    setAnalysisStatus('READY');
  };

  // WebSocket Bağlantısı (Native WebSocket — Spring WebFlux uyumlu)
  useEffect(() => {
    if (!reportId || !isScanning) return;

    let resolved = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/notifications`;
    console.log('[WS] Bağlantı kuruluyor:', wsUrl, '| reportId:', reportId);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS] Bağlantı BAŞARILI:', wsUrl);
    };

    ws.onmessage = async (event) => {
      console.log('[WS] Ham mesaj alındı:', event.data);
      try {
        const body = JSON.parse(event.data);
        console.log('[WS] Parse edildi:', body, '| Beklenen reportId:', reportId, '| Eşleşme:', body.reportId === reportId);
        if (body.reportId === reportId && body.status === 'READY') {
          resolved = true;
          await handleReportReady('WS');
        }
      } catch (error) {
        console.error('[WS] Parse hatası:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] HATA:', error);
    };

    ws.onclose = (event) => {
      console.log('[WS] Bağlantı kapandı:', { code: event.code, reason: event.reason, wasClean: event.wasClean });
    };

    // Fallback: WS çalışmazsa 10sn sonra polling başlat
    let activePollInterval: ReturnType<typeof setInterval> | null = null;

    const pollTimer = setTimeout(() => {
      if (resolved) return;
      console.log('[POLL] WebSocket mesajı gelmedi, polling başlatılıyor...');

      activePollInterval = setInterval(async () => {
        if (resolved) { if (activePollInterval) clearInterval(activePollInterval); return; }
        try {
          const res = await axios.get(`/api/v1/reports/${reportId}`);
          const report = res.data?.data;
          console.log('[POLL] Rapor durumu:', report?.status);
          if (report?.status === 'REVIEW_NEEDED' && report?.aiDraftText) {
            resolved = true;
            if (activePollInterval) clearInterval(activePollInterval);
            await handleReportReady('POLL');
          }
        } catch (err) {
          console.error('[POLL] Hata:', err);
        }
      }, 5000);
    }, 10000);

    return () => {
      ws.close();
      clearTimeout(pollTimer);
      if (activePollInterval) clearInterval(activePollInterval);
    };
  }, [reportId, isScanning]);

  // Daktilo efekti — state-driven, textarea-uyumlu
  useEffect(() => {
    if (!isReady || !aiDraftText) return;

    let currentIndex = 0;
    const speed = 25; // ms per character

    const interval = setInterval(() => {
      if (currentIndex <= aiDraftText.length) {
        const textSoFar = aiDraftText.slice(0, currentIndex);
        setDisplayText(textSoFar);
        currentIndex++;
      } else {
        clearInterval(interval);
        setEditedText(aiDraftText);
        setTypewriterComplete(true);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [isReady, aiDraftText]);

  // Textarea otomatik scroll — daktilo sırasında
  useEffect(() => {
    if (textareaRef.current && !typewriterComplete) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [displayText, typewriterComplete]);

  // Doktor düzenlemelerini takip et
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setEditedText(newText);
    setIsEdited(newText !== aiDraftText);
  }, [aiDraftText]);

  // Onaylama mekanizması (PUT İsteği) — doktorun düzenlediği metni gönderir
  const handleApproveClick = async () => {
    if (!reportId || !editedText.trim()) return;

    setIsApproving(true);

    try {
      await axios.put(`/api/v1/reports/${reportId}`, {
        doctorFinalText: editedText,
        status: 'APPROVED'
      });

      toast.success('Rapor Başarıyla Kaydedildi!');
      resetStore();
      onApprove(); // Ana sayfaya yönlendir

    } catch (error: any) {
      console.error("Approve error:", error);
      toast.error(error.response?.data?.message || 'Rapor kaydedilirken bir hata oluştu.');
      setIsApproving(false);
    }
  };

  return (
    <motion.div
      className="w-full flex p-6 gap-6 relative"
      animate={{
        boxShadow: isScanning
          ? ["inset 0 0 0px rgba(59,130,246,0)", "inset 0 0 40px rgba(59,130,246,0.15)", "inset 0 0 0px rgba(59,130,246,0)"]
          : "inset 0 0 0px rgba(59,130,246,0)"
      }}
      transition={{ duration: 1.5, repeat: isScanning ? Infinity : 0, ease: "easeInOut" }}
    >
      {/* SOL PANEL - %60 Genişlik */}
      <div className="w-[60%] border border-slate-800/80 rounded-3xl bg-slate-900/60 overflow-hidden relative flex flex-col shadow-2xl backdrop-blur-md">
        <div className="p-4 border-b border-slate-800/60 bg-slate-900/90 flex items-center justify-between z-20">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-primary animate-pulse' : 'bg-green-500'}`} />
            MR Görüntüleyicisi
          </h2>
          <span className="text-xs font-medium px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 backdrop-blur-sm">
            {isReady ? 'Analiz Tamamlandı' : 'Sistem Taraması Aktif...'}
          </span>
        </div>

        <div className="flex-1 relative bg-slate-950 flex items-center justify-center p-4 overflow-hidden">
          {imageUrl && (
            <div className="relative max-w-full max-h-full inline-block">
              <img
                src={imageUrl}
                alt="MR Görüntüsü"
                className="max-w-full max-h-[75vh] object-contain rounded-lg opacity-90"
              />

              {/* Tarama Çizgisi Animasyonu */}
              {isScanning && (
                <motion.div
                  initial={{ top: '0%' }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 2.5, ease: "linear", repeat: Infinity }}
                  className="absolute left-0 right-0 h-[2px] bg-blue-400 shadow-[0_0_20px_5px_rgba(59,130,246,0.7)] z-10"
                />
              )}

              {/* Bounding box kaldırıldı — AI koordinat verisi olmadan çizim yapılmaz */}
            </div>
          )}
        </div>
      </div>

      {/* SAĞ PANEL - %40 Genişlik */}
      <div className="w-[40%] flex flex-col gap-5">
        <div className="flex-1 border border-slate-800/80 rounded-3xl bg-slate-900/60 p-7 flex flex-col shadow-2xl backdrop-blur-md relative overflow-hidden">

          <div className="flex items-center gap-4 mb-6 border-b border-slate-800/60 pb-5">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-inner">
              <Bot className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-xl text-slate-100 tracking-tight">Yapay Zeka Taslak Raporu</h2>
              <p className="text-xs text-slate-400 font-medium tracking-wide">MediCopilot LLM V1.2</p>
            </div>
          </div>

          {/* İçerik Editörü */}
          <div className="flex-1 relative flex flex-col">
            {isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-sm">
                <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-4" />
                <span>Görüntü analiz ediliyor...</span>
              </div>
            )}

            {isReady && !typewriterComplete && (
              <div className="absolute bottom-4 right-4 z-10">
                <AudioWaveform />
              </div>
            )}

            {/* Düzenleme göstergesi */}
            {typewriterComplete && (
              <div className="flex items-center gap-2 mb-2">
                <PenLine className="w-3.5 h-3.5 text-primary/60" />
                <span className="text-xs text-slate-400 font-medium">
                  {isEdited ? 'Doktor Tarafından Düzenlendi' : 'Düzenlemek için tıklayın'}
                </span>
                {isEdited && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-semibold">
                    Değiştirildi
                  </span>
                )}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={typewriterComplete ? editedText : displayText}
              onChange={handleTextChange}
              readOnly={!typewriterComplete}
              placeholder="AI raporu bekleniyor..."
              className={`flex-1 w-full rounded-2xl border px-5 py-4 text-sm shadow-inner transition-all resize-none font-mono leading-relaxed text-slate-300 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30
                ${!isReady ? 'opacity-0' : 'opacity-100'}
                ${typewriterComplete
                  ? 'bg-slate-950/40 border-primary/30 cursor-text focus-visible:border-primary/50'
                  : 'bg-transparent border-slate-800/60 cursor-default'
                }
                ${isEdited ? 'border-amber-500/40' : ''}
              `}
              style={{ minHeight: '200px' }}
            />
          </div>
        </div>

        {/* Yasal Onay Butonu */}
        <div className="mt-auto">
          <Button
            className={`w-full h-16 text-lg font-semibold rounded-2xl transition-all duration-300 shadow-xl ${typewriterComplete && !isApproving ? 'hover:shadow-primary/20 hover:scale-[1.01]' : ''}`}
            size="lg"
            disabled={!typewriterComplete || isApproving}
            onClick={handleApproveClick}
            variant={typewriterComplete ? 'default' : 'secondary'}
          >
            {isApproving ? (
              <>
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                Kaydediliyor...
              </>
            ) : typewriterComplete ? (
              <>
                <CheckCircle2 className="w-6 h-6 mr-2" />
                İnceledim ve Onaylıyorum
              </>
            ) : (
              'Rapor Oluşturuluyor...'
            )}
          </Button>
        </div>
      </div>

    </motion.div>
  );
}
