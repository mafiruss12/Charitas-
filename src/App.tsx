import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { AuthViews } from './components/AuthViews';
import { LandingView } from './components/LandingView';
import { Phase1Workspace } from './components/Phase1Workspace';
import { OfflineIndicator } from './components/PWAInstallButton';
import { SplashScreen } from './components/SplashScreen';
import { AuthProvider, useAuth } from './context/AuthContext';

const AppRouter: React.FC = () => {
  const { user, loading, theme, setTheme } = useAuth();
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register' | 'forgot'>('landing');
  const [prefillChurchId, setPrefillChurchId] = useState<number | undefined>();
  const [prefillInviteCode, setPrefillInviteCode] = useState<string | undefined>();
  const [introActive, setIntroActive] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem('charitas_splash_seen');
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!introActive) return;
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem('charitas_splash_seen', '1');
      } catch {
        // ignore storage errors
      }
      setIntroActive(false);
    }, 950);
    return () => window.clearTimeout(timer);
  }, [introActive]);

  const dismissIntro = () => {
    try {
      sessionStorage.setItem('charitas_splash_seen', '1');
    } catch {
      // ignore
    }
    setIntroActive(false);
  };

  let mainContent: React.ReactNode;
  if (loading) {
    mainContent = null;
  } else if (user) {
    mainContent = <Phase1Workspace />;
  } else if (authMode === 'landing') {
    mainContent = (
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
  } else {
    mainContent = (
      <AuthViews
        initialMode={authMode}
        prefillChurchId={prefillChurchId}
        prefillInviteCode={prefillInviteCode}
        onBackToLanding={() => setAuthMode('landing')}
      />
    );
  }

  return (
    <>
      <AnimatePresence>
        {(loading || introActive) && (
          <SplashScreen
            message={
              loading
                ? 'Vérification de votre session CHARITAS...'
                : 'Chargement de CHARITAS — Église Saint Louis Roi d’Ebimpé...'
            }
            onSkip={!loading ? dismissIntro : undefined}
          />
        )}
      </AnimatePresence>
      {mainContent}
      <OfflineIndicator />
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
