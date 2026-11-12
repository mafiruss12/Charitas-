import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthViews } from './components/AuthViews';
import { LandingView } from './components/LandingView';
import { Phase1Workspace } from './components/Phase1Workspace';
import { AuthProvider, useAuth } from './context/AuthContext';

const AppRouter: React.FC = () => {
  const { user, loading, theme, setTheme } = useAuth();
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register' | 'forgot'>('landing');
  const [prefillChurchId, setPrefillChurchId] = useState<number | undefined>();
  const [prefillInviteCode, setPrefillInviteCode] = useState<string | undefined>();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#0B111E] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1B365D] dark:text-amber-400" />
          <p className="text-xs text-stone-600 dark:text-slate-400">
            Chargement de Charitas — Église Saint Louis Roi d’Ebimpé...
          </p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Phase1Workspace />;
  }

  if (authMode === 'landing') {
    return (
      <LandingView
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onOpenAuth={(mode, prefill) => {
          setPrefillChurchId(prefill?.churchId);
          setPrefillInviteCode(prefill?.inviteCode);
          setAuthMode(mode);
        }}
      />
    );
  }

  return (
    <AuthViews
      initialMode={authMode}
      prefillChurchId={prefillChurchId}
      prefillInviteCode={prefillInviteCode}
      onBackToLanding={() => setAuthMode('landing')}
    />
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
