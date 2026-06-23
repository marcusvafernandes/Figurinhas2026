/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { LogIn, Rocket, ShieldAlert, Check, PhoneCall, ArrowUpRight } from 'lucide-react';

interface AuthProps {
  onSuccess?: () => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  // Initialize stats using localStorage cached values or base demo seeded numbers if first run
  const [totals, setTotals] = useState<{ users: number; repeated: number }>(() => {
    const cachedUsers = localStorage.getItem('copa_public_stats_users');
    const cachedRepeated = localStorage.getItem('copa_public_stats_repeated');
    return {
      users: cachedUsers ? parseInt(cachedUsers, 10) : 3,
      repeated: cachedRepeated ? parseInt(cachedRepeated, 10) : 300
    };
  });

  // Track if this is a repeat visit (access after first-time login)
  const [hasVisited, setHasVisited] = useState(() => localStorage.getItem('copa_visited') === 'true');

  // Real-time general activity stats fetch from the aggregate system stats document
  React.useEffect(() => {
    const statsDocRef = doc(db, 'system_stats', 'global');
    const unsub = onSnapshot(statsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const liveUsers = Number(data.users || 3);
        const liveRepeated = Number(data.repeated || 300);
        setTotals({
          users: liveUsers,
          repeated: liveRepeated
        });
        localStorage.setItem('copa_public_stats_users', String(liveUsers));
        localStorage.setItem('copa_public_stats_repeated', String(liveRepeated));
      }
    }, (err) => {
      console.warn("Could not fetch real-time public stats from system_stats (using cache):", err);
    });

    return () => unsub();
  }, []);

  // Helper to ensure user document exists in Firestore
  const ensureUserInFirestore = async (uid: string, info: { email: string; displayName: string; photoURL?: string; whatsappValue?: string }) => {
    const userRef = doc(db, 'users', uid);
    try {
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, {
          uid,
          displayName: info.displayName || 'Colecionador(a)',
          email: info.email,
          photoURL: info.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${uid}`,
          whatsapp: info.whatsappValue || whatsapp || '',
          createdAt: serverTimestamp()
        });
      } else if (whatsapp) {
        // If document exists and we have a new whatsapp provided, update it
        await setDoc(userRef, { whatsapp }, { merge: true });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowConfigGuide(false);
    
    if (!email || !password) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (isRegister && !displayName) {
      setError('Por favor, digite seu nome de cadastro.');
      return;
    }

    setLoading(true);
    try {
      // --- 🌐 Regular Firebase Online Sign-In/Up ---
      if (isRegister) {
        // Sign Up
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, {
          displayName: displayName
        });
        await ensureUserInFirestore(credential.user.uid, {
          email,
          displayName,
          whatsappValue: whatsapp
        });
      } else {
        // Sign In
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await ensureUserInFirestore(credential.user.uid, {
          email: credential.user.email || email,
          displayName: credential.user.displayName || 'Colecionador(a)'
        });
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('O login por E-mail/Senha está desativado no Firebase.');
        setShowConfigGuide(true);
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(err.message || 'Ocorreu um erro na autenticação.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setShowConfigGuide(false);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      if (credential.user) {
        await ensureUserInFirestore(credential.user.uid, {
          email: credential.user.email || '',
          displayName: credential.user.displayName || 'Colecionador(a)',
          photoURL: credential.user.photoURL || undefined
        });
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      setError('Erro ao entrar com Google: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 text-slate-800 font-sans">
      
      {/* Visual Left Banner */}
      <div className="md:w-1/2 flex flex-col justify-between p-8 md:p-16 bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 relative overflow-hidden border-b md:border-b-0 md:border-r border-slate-200/60 shadow-sm animate-fade-in">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#2e7d32_1px,transparent_1px)] [background-size:24px_24px]"></div>
        
        {/* Top Branding Header */}
        <div className="relative z-10">
          <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold font-mono mb-6">
            🤝 Troque suas figurinhas com outros colecionadores
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-none bg-gradient-to-r from-emerald-600 via-sky-600 to-amber-500 bg-clip-text text-transparent">
            Figurinhas Copa 2026
          </h1>
          <p className="mt-4 text-slate-600 max-w-sm text-sm md:text-base leading-relaxed">
            Gerencie seu álbum, marque suas figurinhas repetidas e faltantes, e encontre trocas perfeitas de forma 100% automatizada no Firebase.
          </p>
        </div>

        {/* Potencial de Troca / Live Stats */}
        {hasVisited && (
          <div id="live_stats_card" className="relative z-10 my-6 bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-emerald-100/80 shadow-sm animate-fade-in">
            <p className="text-[10px] font-mono uppercase font-extrabold tracking-wider text-emerald-800 mb-3 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Atividade Geral do Sistema
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/90 p-3.5 rounded-xl border border-slate-200/60 flex flex-col shadow-sm">
                <span className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight font-sans">
                  <span className="animate-fade-in">{totals.users}</span>
                </span>
                <span className="text-[11px] text-slate-500 font-bold mt-1">Colecionadores</span>
              </div>
              <div className="bg-white/90 p-3.5 rounded-xl border border-slate-200/60 flex flex-col shadow-sm">
                <span className="text-2xl md:text-3xl font-black text-emerald-700 tracking-tight font-sans">
                  <span className="animate-fade-in">{totals.repeated}</span>
                </span>
                <span className="text-[11px] text-slate-500 font-bold mt-1">Figurinhas Repetidas</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-3 leading-normal font-medium">
              🔥 Trocas 1x1 recíprocas são calculadas em tempo real assim que você adiciona suas figurinhas repetidas e faltantes!
            </p>
          </div>
        )}

        {/* Feature List */}
        <div className="relative z-10 my-10 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-1 rounded-md bg-emerald-100 text-emerald-800 mt-0.5 animate-pulse">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">Controle de Álbum Completo</p>
              <p className="text-xs text-slate-500">Marque todas as seleções e especiais com sincronização em tempo real na nuvem.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-1 rounded-md bg-emerald-100 text-emerald-800 mt-0.5">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">Match de Troca Perfeito</p>
              <p className="text-xs text-slate-500">Descubra automaticamente outros colecionadores com quem você tem trocas mútuas exatas.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-1 rounded-md bg-emerald-100 text-emerald-800 mt-0.5">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">Negociação Direta & Trocas</p>
              <p className="text-xs text-slate-500">Identificação das figurinhas dos outros colecionadores que faltam e contato ágil para combinar a troca.</p>
            </div>
          </div>
        </div>

        {/* Bottom design credits */}
        <div className="relative z-10 text-xs text-slate-400 font-mono">
          © 2026 Copa Sticker Matcher Engine. Todos os direitos reservados.
        </div>
      </div>

      {/* Auth Interaction Form Panel */}
      <div className="md:w-1/2 flex items-center justify-center p-8 md:p-16 bg-white">
        <div id="auth_card" className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-xl relative">
          
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">
              Conectar Conta Firebase
            </h2>
            <p className="text-slate-500 text-xs mt-1">
              Faça login para salvar seus dados do álbum de figurinhas permanentemente
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex flex-col gap-3 animate-fade-in">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{error}</span>
              </div>
              
              {showConfigGuide && (
                <div id="bypass_guide" className="mt-2 pt-2 border-t border-red-200/60 flex flex-col gap-2 text-slate-700">
                  <p className="leading-relaxed">
                    Por padrão, os projetos do Firebase exigem ativação manual do provedor de e-mail/senha.
                  </p>
                  <p className="font-medium text-slate-800">
                    Como ativar no Firebase Console:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1.5 text-[11px]">
                    <li>Acesse o Firebase Console.</li>
                    <li>Vá em <strong className="text-emerald-700">Authentication</strong> e clique na aba <strong className="text-emerald-700">Sign-in method</strong>.</li>
                    <li>Clique em <strong className="text-emerald-700">Adicionar novo provedor</strong> e selecione <strong className="text-emerald-700">E-mail/Senha</strong>.</li>
                    <li>Ative o provedor e clique em salvar.</li>
                  </ol>
                  <p className="mt-1 font-bold text-slate-800">
                    💡 Alternativa Imediata:
                  </p>
                  <p>
                    O <strong className="text-emerald-700">Login com Google</strong> já está ativo e funciona instantaneamente em qualquer projeto sem configurações extras!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Google Sign In as the Primary, Ready-to-use Auth */}
          <div className="mb-6 space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
            >
              <Rocket className="w-4 h-4 text-white animate-pulse" />
              Entrar com Conta Google (Instantâneo)
            </button>
            <p className="text-[10px] text-center text-slate-400 font-mono">
              ★ Recomendado
            </p>
          </div>

          <div className="relative my-6 flex items-center justify-center">
            <span className="absolute inset-x-0 h-px bg-slate-200"></span>
            <span className="relative bg-white px-3 text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">Ou use credenciais</span>
          </div>

          {/* Credentials Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Seu Nome / Apelido *</label>
                <input 
                  type="text" 
                  autoComplete="name"
                  placeholder="Ex: Marcus"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-sm placeholder:text-slate-400 transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">E-mail *</label>
              <input 
                type="email" 
                autoComplete="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-sm placeholder:text-slate-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Senha *</label>
              <input 
                type="password" 
                autoComplete="current-password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-sm placeholder:text-slate-400 transition"
              />
            </div>

            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">
                  <span>WhatsApp / Telefone para Contato</span>
                  <span className="text-[10px] text-emerald-600 font-bold font-mono">(Recomendado)</span>
                </label>
                <div className="relative">
                  <PhoneCall className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input 
                     type="tel" 
                     placeholder="Ex: 11988880001"
                     value={whatsapp}
                     onChange={(e) => setWhatsapp(e.target.value)}
                     className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-sm placeholder:text-slate-400 transition"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Facilita a negociação direta com colecionadores por WhatsApp.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm transition shadow-sm flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-55"
            >
              <LogIn className="w-4 h-4" />
              {loading ? 'Processando...' : isRegister ? 'Cadastrar e Entrar' : 'Entrar com E-mail'}
            </button>
          </form>

          {/* Toggle Screen */}
          <div className="text-center mt-6">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
                setShowConfigGuide(false);
              }}
              className="text-xs text-emerald-600 hover:underline hover:text-emerald-700 font-bold transition"
            >
              {isRegister ? 'Já tem conta? Entre aqui' : 'Não tem conta? Cadastre-se aqui'}
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
