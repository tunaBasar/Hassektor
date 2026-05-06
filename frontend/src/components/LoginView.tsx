import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Stethoscope, Loader2, KeyRound } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export function LoginView() {
  const { setIsAuthenticated } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsLoading(true);
    // Fake 1s API delay
    setTimeout(() => {
      setIsLoading(false);
      setIsAuthenticated(true);
    }, 1000);
  };

  return (
    <div className="w-full flex items-center justify-center min-h-full px-4">
      <Card className="w-full max-w-md bg-slate-900/60 border-slate-800/80 shadow-[0_0_40px_-10px_rgba(59,130,246,0.15)] backdrop-blur-xl relative overflow-hidden rounded-3xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-primary to-purple-600" />

        <CardHeader className="text-center pt-10 pb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 border border-primary/20 shadow-inner">
            <Stethoscope className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-100 tracking-tight">MediCopilot</CardTitle>
          <CardDescription className="text-slate-400 mt-2 font-medium">Doktor Giriş Paneli</CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-10">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kullanıcı Adı</label>
              <Input
                type="text"
                placeholder="Örn: DR-12345"
                className="h-12 bg-slate-950/50 border-slate-800 focus-visible:ring-primary/50 rounded-xl"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Şifre</label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="••••••••"
                  className="h-12 bg-slate-950/50 border-slate-800 focus-visible:ring-primary/50 rounded-xl pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <KeyRound className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold rounded-xl mt-4 shadow-primary/20 shadow-lg hover:shadow-primary/30 transition-all"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Doğrulanıyor...
                </>
              ) : (
                'Giriş Yap'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
