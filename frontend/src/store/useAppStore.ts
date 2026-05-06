import { create } from 'zustand';

export type AnalysisStatus = 'IDLE' | 'UPLOADING' | 'SCANNING' | 'READY';

interface AppState {
  isAuthenticated: boolean;
  doctorId: string | null;
  doctorName: string | null;
  reportId: string | null;
  aiDraftText: string;
  analysisStatus: AnalysisStatus;
  
  setIsAuthenticated: (status: boolean) => void;
  setDoctorInfo: (id: string, name: string) => void;
  setReportId: (id: string | null) => void;
  setAiDraftText: (text: string) => void;
  setAnalysisStatus: (status: AnalysisStatus) => void;
  resetStore: () => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  doctorId: null,
  doctorName: null,
  reportId: null,
  aiDraftText: '',
  analysisStatus: 'IDLE',
  
  setIsAuthenticated: (status) => set({ isAuthenticated: status }),
  setDoctorInfo: (id, name) => set({ doctorId: id, doctorName: name }),
  setReportId: (id) => set({ reportId: id }),
  setAiDraftText: (text) => set({ aiDraftText: text }),
  setAnalysisStatus: (status) => set({ analysisStatus: status }),
  
  resetStore: () => set({
    reportId: null,
    aiDraftText: '',
    analysisStatus: 'IDLE'
  }),
  
  logout: () => set({
    isAuthenticated: false,
    doctorId: null,
    doctorName: null,
    reportId: null,
    aiDraftText: '',
    analysisStatus: 'IDLE'
  }),
}));
