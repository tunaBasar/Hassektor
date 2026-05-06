import { create } from 'zustand';

export type AnalysisStatus = 'IDLE' | 'UPLOADING' | 'SCANNING' | 'READY';

interface AppState {
  isAuthenticated: boolean;
  reportId: string | null;
  aiDraftText: string;
  analysisStatus: AnalysisStatus;
  
  setIsAuthenticated: (status: boolean) => void;
  setReportId: (id: string | null) => void;
  setAiDraftText: (text: string) => void;
  setAnalysisStatus: (status: AnalysisStatus) => void;
  resetStore: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  reportId: null,
  aiDraftText: '',
  analysisStatus: 'IDLE',
  
  setIsAuthenticated: (status) => set({ isAuthenticated: status }),
  setReportId: (id) => set({ reportId: id }),
  setAiDraftText: (text) => set({ aiDraftText: text }),
  setAnalysisStatus: (status) => set({ analysisStatus: status }),
  
  resetStore: () => set({
    reportId: null,
    aiDraftText: '',
    analysisStatus: 'IDLE'
  }),
}));
