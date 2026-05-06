import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Bot, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
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
  const [renderedHTML, setRenderedHTML] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const { reportId, analysisStatus, setAnalysisStatus, aiDraftText, setAiDraftText, resetStore } = useAppStore();

  const isScanning = analysisStatus === 'SCANNING';
  const isReady = analysisStatus === 'READY';

  // Dosya URL'si
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // WebSocket / STOMP Bağlantısı
  useEffect(() => {
    if (!reportId || !isScanning) return;

    const socket = new SockJS('/ws/notifications');
    const client = new Client({
      webSocketFactory: () => socket as any,
      debug: function (str) {
        console.log('STOMP: ' + str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.onConnect = function (frame) {
      console.log('Connected: ' + frame);
      
      client.subscribe('/topic/reports', (message) => {
        try {
          const body = JSON.parse(message.body);
          if (body.report_id === reportId && body.status === 'READY') {
            toast.success("Yapay Zeka Raporu Hazır!", {
              className: 'bg-green-600 text-white border-none'
            });
            setAiDraftText(body.ai_draft_text);
            setAnalysisStatus('READY');
          }
        } catch (error) {
          console.error("STOMP parse error:", error);
        }
      });
    };

    client.onStompError = function (frame) {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    };

    client.activate();

    return () => {
      client.deactivate();
    };
  }, [reportId, isScanning, setAiDraftText, setAnalysisStatus]);

  // Daktilo efekti
  useEffect(() => {
    if (!isReady || !aiDraftText) return;

    let currentIndex = 0;
    const speed = 25; // ms per character
    let currentHtml = '';
    
    const highlightKeywords = (text: string) => {
      let html = text;
      // Gelişmiş regex veya NLP gerekebilir, şimdilik basit örnekler:
      const keywords = ['lezyon', 'anomali', 'şüpheli', 'benign', 'korelasyon', 'malign'];
      keywords.forEach(kw => {
        const regex = new RegExp(`(${kw})`, 'gi');
        html = html.replace(regex, '<b>$1</b>');
      });
      // 3mm, 5cm gibi ölçüleri yakalamak
      html = html.replace(/(\d+(?:[.,]\d+)?\s*(?:mm|cm|ml))/gi, '<b>$1</b>');
      return html;
    };

    const interval = setInterval(() => {
      if (currentIndex <= aiDraftText.length) {
        const textSoFar = aiDraftText.slice(0, currentIndex);
        currentHtml = highlightKeywords(textSoFar);
        setRenderedHTML(currentHtml);
        
        if (editorRef.current) {
           editorRef.current.scrollTop = editorRef.current.scrollHeight;
        }
        
        currentIndex++;
      } else {
        clearInterval(interval);
        setTypewriterComplete(true);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [isReady, aiDraftText]);

  // İçeriği güncelle
  useEffect(() => {
    if (editorRef.current && !typewriterComplete) {
      editorRef.current.innerHTML = renderedHTML;
    }
  }, [renderedHTML, typewriterComplete]);

  // Onaylama mekanizması (PUT İsteği)
  const handleApproveClick = async () => {
    if (!reportId || !editorRef.current) return;
    
    setIsApproving(true);
    const finalHtmlText = editorRef.current.innerHTML;
    const plainText = editorRef.current.innerText; // Backend'in ihtiyacına göre

    try {
      await axios.put(`/api/v1/reports/${reportId}`, {
        final_text: plainText,
        html_text: finalHtmlText
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

              {/* Anomali Çerçevesi (Bounding Box) - READY olduğunda göster */}
              <AnimatePresence>
                {isReady && (
                  <motion.div
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: [0.4, 1, 0.4], scale: 1 }}
                    transition={{ opacity: { repeat: Infinity, duration: 2, ease: "easeInOut" }, scale: { duration: 0.5, ease: "easeOut" } }}
                    className="absolute border-2 border-red-500 rounded-sm z-20 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                    style={{ top: '25%', left: '60%', width: '45px', height: '45px' }}
                  >
                    <div className="absolute -top-7 -right-2 bg-red-500/90 backdrop-blur-sm text-white text-[11px] px-2 py-1 rounded font-bold whitespace-nowrap shadow-md border border-red-400/50">
                      %89 Anomali
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

            <div 
              ref={editorRef}
              className={`flex-1 w-full rounded-2xl border border-slate-800/60 px-5 py-4 text-sm shadow-inner transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto leading-relaxed text-slate-300
                ${!isReady ? 'opacity-0' : 'opacity-100'}
                ${typewriterComplete ? 'bg-slate-950/40 cursor-text' : 'bg-transparent cursor-default'}
              `}
              contentEditable={typewriterComplete}
              suppressContentEditableWarning={true}
              style={{ minHeight: '200px' }}
            >
              {/* Typewriter buraya yazacak */}
            </div>
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
