import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileImage, X, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import axios from 'axios';
import { useAppStore } from '@/store/useAppStore';

interface UploadViewProps {
  onAnalyze: (file: File) => void;
}

export function UploadView({ onAnalyze }: UploadViewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { analysisStatus, setAnalysisStatus, setReportId, resetStore, doctorId } = useAppStore();

  const isUploading = analysisStatus === 'UPLOADING';

  const validateFile = (selectedFile: File) => {
    const validTypes = ['image/jpeg', 'image/png'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Sadece .jpg, .jpeg ve .png formatındaki dosyalar kabul edilmektedir.');
      return false;
    }
    return true;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragging(true);
  }, [isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (isUploading) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      const selectedFile = droppedFiles[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  }, [isUploading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      const selectedFile = selectedFiles[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isUploading) {
      setFile(null);
    }
  };

  const handleAnalyze = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!file || isUploading) return;
    
    try {
      setAnalysisStatus('UPLOADING');
      
      const formData = new FormData();
      formData.append('file', file);
      if (doctorId) {
        formData.append('doctorId', doctorId);
      }
      
      const response = await axios.post('/api/v1/mri/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const apiResponse = response.data;
      const reportId = apiResponse?.data?.id;
      
      if (!reportId) {
        throw new Error("Sunucudan report_id alınamadı.");
      }
      
      setReportId(reportId);
      setAnalysisStatus('SCANNING');
      toast.success('Dosya başarıyla yüklendi, analiz başlatılıyor...');
      
      onAnalyze(file);
      
    } catch (error: any) {
      console.error("Upload error:", error);
      resetStore();
      toast.error(error.response?.data?.message || 'Dosya yüklenirken bir hata oluştu. Sunucu bağlantısını kontrol edin.');
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center px-4 md:px-8">
      <div className="text-center mb-12 md:mb-16">
        <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-primary/10 text-primary mb-6 shadow-inner border border-primary/20">
          <UploadCloud className="w-8 h-8 md:w-10 md:h-10" />
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 text-slate-100">MediCopilot</h1>
        <p className="text-slate-400 text-lg md:text-xl max-w-lg mx-auto">Akıllı radyolojik görüntü analiz ve asistan sistemi</p>
      </div>

      <div 
        className={`w-full max-w-4xl border-2 border-dashed rounded-[2rem] p-10 md:p-16 lg:p-24 transition-all duration-300 ease-in-out flex flex-col items-center justify-center shadow-sm relative overflow-hidden
          ${isDragging ? 'border-primary bg-primary/5 scale-[1.02] md:scale-[1.01]' : 'border-slate-800 bg-slate-900/40'}
          ${!isUploading ? 'cursor-pointer hover:border-slate-700 hover:bg-slate-900/60' : 'cursor-not-allowed opacity-80'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !file && !isUploading && fileInputRef.current?.click()}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/20 pointer-events-none" />

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".jpg,.jpeg,.png"
          onChange={handleFileChange}
          disabled={isUploading}
        />

        {!file ? (
          <div className="relative z-10 flex flex-col items-center pointer-events-none">
            <div className={`w-20 h-20 md:w-28 md:h-28 rounded-full bg-slate-800/80 flex items-center justify-center mb-8 text-slate-400 shadow-sm border border-slate-700/50 transition-transform duration-300 ${isDragging ? 'scale-110 text-primary bg-primary/10 border-primary/30' : ''}`}>
              <FileImage className="w-10 h-10 md:w-14 md:h-14" />
            </div>
            <h3 className="text-xl md:text-2xl font-semibold mb-3 text-slate-200">Görüntüyü Sürükleyin</h3>
            <p className="text-slate-500 md:text-lg mb-10 text-center max-w-[280px] md:max-w-md leading-relaxed">
              veya cihazınızdan seçmek için bu alana tıklayın
            </p>
            <div className="flex gap-4 text-xs md:text-sm text-slate-500 font-medium tracking-wide">
              <span className="bg-slate-950/50 px-4 py-2 rounded-lg border border-slate-800/60 backdrop-blur-sm">.JPG</span>
              <span className="bg-slate-950/50 px-4 py-2 rounded-lg border border-slate-800/60 backdrop-blur-sm">.JPEG</span>
              <span className="bg-slate-950/50 px-4 py-2 rounded-lg border border-slate-800/60 backdrop-blur-sm">.PNG</span>
            </div>
          </div>
        ) : (
          <div className="w-full relative z-10 flex flex-col items-center">
            <Card className="w-full bg-slate-900/90 border-slate-700/60 mb-8 shadow-lg backdrop-blur-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                    <FileImage className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 pr-4">
                    <p className="text-base font-semibold truncate text-slate-100 mb-1">{file.name}</p>
                    <p className="text-sm text-slate-400 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={removeFile} 
                  disabled={isUploading}
                  className="text-slate-400 hover:text-red-400 hover:bg-red-400/10 shrink-0 h-10 w-10 rounded-full transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </Button>
              </CardContent>
            </Card>
            
            <Button 
              onClick={handleAnalyze} 
              disabled={isUploading}
              className="w-full sm:w-auto px-10 h-14 text-base shadow-primary/20 shadow-lg hover:shadow-primary/30 transition-all rounded-xl font-semibold" 
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Yükleniyor...
                </>
              ) : (
                <>
                  Analize Gönder
                  <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
      
      <div className="mt-16 text-center text-slate-500 text-sm md:text-base max-w-xl">
        <p>Yüklenen görüntüler uçtan uca şifrelenir ve analiz sonrası tamamen silinir. Kişisel verileriniz KVKK kapsamında korunmaktadır.</p>
      </div>
    </div>
  );
}
