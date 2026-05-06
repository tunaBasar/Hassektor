import React, { useState } from 'react';
import { UploadView } from './components/UploadView';
import { DashboardView } from './components/DashboardView';
import { LoginView } from './components/LoginView';
import { Toaster } from '@/components/ui/sonner';
import { useAppStore } from '@/store/useAppStore';

function App() {
  const [view, setView] = useState<'upload' | 'dashboard'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { isAuthenticated } = useAppStore();

  const handleAnalyze = (file: File) => {
    setSelectedFile(file);
    setView('dashboard');
  };

  const handleApprove = () => {
    alert("Rapor onaylandı ve sisteme kaydedildi.");
    setView('upload');
    setSelectedFile(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0f1c] relative overflow-hidden flex flex-col">
      {/* Grid Pattern Arka Plan */}
      <div className="absolute inset-0 w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      
      {/* Neon Aura Efekti */}
      <div className="absolute top-[-50%] left-[-20%] w-[140%] h-[150%] pointer-events-none bg-[radial-gradient(circle_at_50%_40%,rgba(59,130,246,0.1),transparent_60%)]" />
      <div className="absolute inset-0 w-full h-full pointer-events-none shadow-[inset_0_0_150px_rgba(59,130,246,0.05)]" />
      
      <div className="w-full flex-1 flex flex-col relative z-10">
        <Toaster position="top-center" theme="dark" />
        
        {!isAuthenticated ? (
          <div className="flex-1 flex items-center justify-center p-4 w-full">
            <LoginView />
          </div>
        ) : (
          <>
            {view === 'upload' && (
              <div className="flex-1 flex items-center justify-center p-4">
                <UploadView onAnalyze={handleAnalyze} />
              </div>
            )}
            
            {view === 'dashboard' && selectedFile && (
              <div className="flex-1 flex flex-col p-4 w-full">
                <DashboardView file={selectedFile} onApprove={handleApprove} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
