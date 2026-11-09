import React, { useState } from 'react';
import { ShieldCheck, Key, Lock, Mail, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (email: string) => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
}) => {
  const [adminPin, setAdminPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const [domainWarning, setDomainWarning] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'Netlify';

  // Handle Quick Master PIN login (Works anywhere without requiring Firebase OAuth domain configuration)
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPin = adminPin.trim().toLowerCase();
    // Accepted admin master codes or the admin email itself
    const validCodes = ['sac1contable', 'sac1admin', 'sac1contable@gmail.com', 'admin2025', 'sac12025'];

    if (validCodes.includes(cleanPin) || cleanPin === 'sac1contable@gmail.com') {
      const email = 'sac1contable@gmail.com';
      localStorage.setItem('seniat_iva_admin_user', email);
      onAuthenticated(email);
      onClose();
    } else {
      setErrorMsg('Clave de administrador incorrecta. Ingrese "sac1contable" o su correo autorizado.');
    }
  };

  // Handle Google OAuth Sign-In with friendly error catching for Netlify domains
  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setDomainWarning(null);
    setIsLoggingInGoogle(true);

    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const email = res.user.email || '';

      if (email.toLowerCase() === 'sac1contable@gmail.com') {
        localStorage.setItem('seniat_iva_admin_user', email);
        onAuthenticated(email);
        onClose();
      } else {
        setErrorMsg(`La cuenta ${email} no tiene permisos de administrador. Solo sac1contable@gmail.com.`);
      }
    } catch (err: any) {
      console.warn('Google sign-in caught:', err);
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized domain')) {
        setDomainWarning(
          `El dominio actual (${currentHost}) no está registrado en Firebase. Puedes ingresar de inmediato con la Clave de Administrador abajo.`
        );
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Ventana de acceso cerrada antes de completar.');
      } else {
        setErrorMsg(err.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Acceso Administrador DB</h3>
              <p className="text-xs text-zinc-400">Exclusivo para sac1contable@gmail.com</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Option 1: Direct Master Key Entry (Guaranteed to work in Netlify/Hosting) */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-xs uppercase tracking-wider">
              <Key className="w-4 h-4 text-amber-600" />
              <span>Acceso Directo con Clave de Administrador</span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Ideal para cuando estás en <strong>Netlify</strong> o fuera de localhost. Introduce la clave maestra para ingresar de inmediato como <strong>sac1contable@gmail.com</strong>:
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-2.5">
              <div className="relative">
                <input
                  type="password"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="Introduce la clave maestra..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-amber-300 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Desbloquear Panel DB Admin</span>
              </button>
            </form>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-zinc-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider absolute">
              o con tu cuenta Google
            </span>
          </div>

          {/* Option 2: Google Sign-in */}
          <div>
            <button
              type="button"
              disabled={isLoggingInGoogle}
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoggingInGoogle ? 'Conectando con Google...' : 'Ingresar con cuenta Google'}</span>
            </button>
          </div>

          {/* Warning / Error Messages */}
          {domainWarning && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">{domainWarning}</p>
                <p className="text-[11px] text-amber-800">
                  Para habilitar el botón de Google en Netlify: ve a tu <strong>Consola de Firebase &gt; Authentication &gt; Settings &gt; Authorized domains</strong> y agrega <code>{currentHost}</code>.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
