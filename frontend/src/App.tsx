import { useState } from 'react';
import { UploadView } from './components/UploadView';
import { DashboardView } from './components/DashboardView';
import { ReportsView } from './components/ReportsView';
import { LoginView } from './components/LoginView';
import { Toaster } from '@/components/ui/sonner';
import { useAppStore } from '@/store/useAppStore';
import { UploadCloud, FileText, LogOut, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AppView = 'upload' | 'dashboard' | 'reports';

function App() {
  const [view, setView] = useState<AppView>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { isAuthenticated, doctorName, logout } = useAppStore();

  const handleAnalyze = (file: File) => {
    setSelectedFile(file);
    setView('dashboard');
  };

  const handleApprove = () => {
    setView('reports');
    setSelectedFile(null);
  };

  const handleLogout = () => {
    logout();
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
            {/* Top Navigation Bar */}
            <nav className="w-full border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-30">
              <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo & Brand */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <span className="text-lg font-bold text-slate-100 tracking-tight hidden sm:inline">MediCopilot</span>
                </div>

                {/* Nav Links */}
                <div className="flex items-center gap-1 p-1 bg-slate-950/40 rounded-xl border border-slate-800/40">
                  <button
                    onClick={() => { setView('upload'); setSelectedFile(null); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                      ${view === 'upload' || view === 'dashboard'
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span className="hidden sm:inline">Yeni Analiz</span>
                  </button>
                  <button
                    onClick={() => setView('reports')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                      ${view === 'reports'
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Raporlar</span>
                  </button>
                </div>

                {/* User Menu */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 font-medium hidden md:inline">
                    {doctorName ? `Dr. ${doctorName}` : ''}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl h-9 w-9 transition-colors"
                    title="Çıkış Yap"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </nav>

            {/* Main Content */}
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

            {view === 'reports' && (
              <div className="flex-1 flex flex-col w-full">
                <ReportsView />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
