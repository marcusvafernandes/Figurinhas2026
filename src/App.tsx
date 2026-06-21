/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut, updateProfile, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc,
  onSnapshot, 
  serverTimestamp, 
  getDoc,
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { TEAMS, STICKERS, STICKERS_BY_TEAM } from './data';
import { 
  UserProfile, 
  UserSticker, 
  SingleMatch, 
  DoubleMatch, 
  Chat,
  ToastNotification,
  Sticker
} from './types';
import { motion, AnimatePresence } from 'motion/react';
import Auth from './components/Auth';
import ChatWindow from './components/ChatWindow';

import { 
  BookOpen, 
  Users, 
  MessageSquare, 
  User, 
  Power, 
  Phone, 
  Check, 
  AlertCircle,
  Plus, 
  Minus, 
  Filter, 
  Flame, 
  Sparkles, 
  TrendingUp, 
  Layers, 
  HelpCircle,
  Smartphone,
  ChevronRight,
  ChevronDown,
  Search,
  Database,
  Trash2,
  Share2,
  Copy,
  ArrowUpRight,
  Download,
  Upload,
  ShieldCheck
} from 'lucide-react';

const isStickerSpecial = (id: string): boolean => {
  const s = STICKERS.find(item => item.id === id);
  return !!s?.isSpecial;
};

const getStickerPoints = (id: string): number => {
  return isStickerSpecial(id) ? 2 : 1;
};

const buildDoubleMatchWhatsappLink = (
  phone: string,
  partnerName: string,
  myRepeated: string[],
  myMissing: string[]
) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const withCountry = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
  
  const mySpecials = myRepeated.filter(isStickerSpecial);
  const myNormals = myRepeated.filter(id => !isStickerSpecial(id));
  const myPoints = mySpecials.length * 2 + myNormals.length;
  
  const partnerSpecials = myMissing.filter(isStickerSpecial);
  const partnerNormals = myMissing.filter(id => !isStickerSpecial(id));
  const partnerPoints = partnerSpecials.length * 2 + partnerNormals.length;
  
  let balanceMsg = "";
  if (myPoints === partnerPoints) {
    balanceMsg = "⚖️ Troca em perfeito equilíbrio de valor!";
  } else if (myPoints > partnerPoints) {
    balanceMsg = `⚖️ Equilíbrio de valor: Estou oferecendo +${myPoints - partnerPoints} pontos em valor (pois metalizada vale 2x normais).`;
  } else {
    balanceMsg = `⚖️ Equilíbrio de valor: Você está me oferecendo +${partnerPoints - myPoints} pontos em valor (pois metalizada vale 2x normais).`;
  }

  const text = `Olá ${partnerName}! Vi seu perfil no app *Figurinhas Copa 2026* e temos um *Match Perfeito* de trocas! 🤝\n\n` +
    `🎁 *Eu te dou:* ${myRepeated.join(', ')}\n` +
    `  ↳ ${myNormals.length} normal(is) e ${mySpecials.length} metalizada(s) (Total: ${myPoints} pts)\n\n` +
    `⭐️ *Você me dá:* ${myMissing.join(', ')}\n` +
    `  ↳ ${partnerNormals.length} normal(is) e ${partnerSpecials.length} metalizada(s) (Total: ${partnerPoints} pts)\n\n` +
    `${balanceMsg}\n\n` +
    `Vamos combinar a troca?`;
    
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
};

const buildSingleMatchWhatsappLink = (
  phone: string,
  partnerName: string,
  stickerId: string,
  type: 'he_has_my_missing' | 'i_have_his_missing'
) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const withCountry = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
  
  const isSpecial = isStickerSpecial(stickerId);
  const stickerTypeStr = isSpecial ? 'Metalizada (Vale 2 normais)' : 'Normal';
  
  let text = '';
  if (type === 'he_has_my_missing') {
    text = `Olá ${partnerName}! Vi no app *Figurinhas Copa 2026* que você tem a figurinha repetida [ *${stickerId}* ] (${stickerTypeStr}) que eu preciso muito!\n` +
      `Gostaria de fechar um negócio ou ver minhas repetidas para trocar?`;
  } else {
    text = `Olá ${partnerName}! Vi no app *Figurinhas Copa 2026* que você precisa da figurinha [ *${stickerId}* ] (${stickerTypeStr}) que eu tenho repetida!\n` +
      `Gostaria de fechar uma troca?`;
  }
  
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
};

const DEFAULT_JIMI_STICKERS: Record<string, UserSticker> = {
  'BRA1': { id: 'demo_jimi_copa_BRA1', userId: 'demo_jimi_copa', userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'BRA1', status: 'repeated', quantity: 2, updatedAt: '' },
  'ARG3': { id: 'demo_jimi_copa_ARG3', userId: 'demo_jimi_copa', userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'ARG3', status: 'repeated', quantity: 1, updatedAt: '' },
  'FWC1': { id: 'demo_jimi_copa_FWC1', userId: 'demo_jimi_copa', userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'FWC1', status: 'repeated', quantity: 3, updatedAt: '' },
  'FRA3': { id: 'demo_jimi_copa_FRA3', userId: 'demo_jimi_copa', userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'FRA3', status: 'repeated', quantity: 1, updatedAt: '' },
  'BRA3': { id: 'demo_jimi_copa_BRA3', userId: 'demo_jimi_copa', userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'BRA3', status: 'missing', quantity: 1, updatedAt: '' },
  'POR3': { id: 'demo_jimi_copa_POR3', userId: 'demo_jimi_copa', userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'POR3', status: 'missing', quantity: 1, updatedAt: '' },
  'ESP3': { id: 'demo_jimi_copa_ESP3', userId: 'demo_jimi_copa', userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'ESP3', status: 'missing', quantity: 1, updatedAt: '' },
};

const DEFAULT_RITA_STICKERS: Record<string, UserSticker> = {
  'BRA3': { id: 'demo_rita_copa_BRA3', userId: 'demo_rita_copa', userDisplayName: 'Rita Lee (Demo)', stickerId: 'BRA3', status: 'repeated', quantity: 1, updatedAt: '' },
  'POR3': { id: 'demo_rita_copa_POR3', userId: 'demo_rita_copa', userDisplayName: 'Rita Lee (Demo)', stickerId: 'POR3', status: 'repeated', quantity: 2, updatedAt: '' },
  'USA1': { id: 'demo_rita_copa_USA1', userId: 'demo_rita_copa', userDisplayName: 'Rita Lee (Demo)', stickerId: 'USA1', status: 'repeated', quantity: 1, updatedAt: '' },
  'ARG3': { id: 'demo_rita_copa_ARG3', userId: 'demo_rita_copa', userDisplayName: 'Rita Lee (Demo)', stickerId: 'ARG3', status: 'missing', quantity: 1, updatedAt: '' },
  'FWC1': { id: 'demo_rita_copa_FWC1', userId: 'demo_rita_copa', userDisplayName: 'Rita Lee (Demo)', stickerId: 'FWC1', status: 'missing', quantity: 1, updatedAt: '' },
  'BRA1': { id: 'demo_rita_copa_BRA1', userId: 'demo_rita_copa', userDisplayName: 'Rita Lee (Demo)', stickerId: 'BRA1', status: 'missing', quantity: 1, updatedAt: '' },
};

const DEFAULT_DIEGO_STICKERS: Record<string, UserSticker> = {
  'ECU1': { id: 'demo_diego_copa_ECU1', userId: 'demo_diego_copa', userDisplayName: 'Diego Maradona (Demo)', stickerId: 'ECU1', status: 'repeated', quantity: 1, updatedAt: '' },
  'URU3': { id: 'demo_diego_copa_URU3', userId: 'demo_diego_copa', userDisplayName: 'Diego Maradona (Demo)', stickerId: 'URU3', status: 'repeated', quantity: 1, updatedAt: '' },
  'COL1': { id: 'demo_diego_copa_COL1', userId: 'demo_diego_copa', userDisplayName: 'Diego Maradona (Demo)', stickerId: 'COL1', status: 'repeated', quantity: 2, updatedAt: '' },
  'BRA1': { id: 'demo_diego_copa_BRA1', userId: 'demo_diego_copa', userDisplayName: 'Diego Maradona (Demo)', stickerId: 'BRA1', status: 'missing', quantity: 1, updatedAt: '' },
  'FWC1': { id: 'demo_diego_copa_FWC1', userId: 'demo_diego_copa', userDisplayName: 'Diego Maradona (Demo)', stickerId: 'FWC1', status: 'missing', quantity: 1, updatedAt: '' },
};

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Real-time collections state
  const [myStickers, setMyStickers] = useState<Record<string, UserSticker>>({});
  const [allStickersRecords, setAllStickersRecords] = useState<UserSticker[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, UserProfile>>({});
  const [chats, setChats] = useState<Chat[]>([]);
  
  // App views
  const [activeTab, setActiveTab] = useState<'album' | 'matches' | 'profile' | 'admin'>('album');
  const [albumSubTab, setAlbumSubTab] = useState<'selection' | 'repeated'>('selection');

  // Inline auth states for visitor panel
  const [authFormIsRegister, setAuthFormIsRegister] = useState(false);
  const [authFormEmail, setAuthFormEmail] = useState('');
  const [authFormPassword, setAuthFormPassword] = useState('');
  const [authFormName, setAuthFormName] = useState('');
  const [authFormWhatsapp, setAuthFormWhatsapp] = useState('');
  const [authFormLoading, setAuthFormLoading] = useState(false);
  const [authFormError, setAuthFormError] = useState<string | null>(null);
  const [showLocalBypassFallback, setShowLocalBypassFallback] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  
  // Custom album filters
  const [selectedGroup, setSelectedGroup] = useState<string>('TODOS');
  const [selectedTeam, setSelectedTeam] = useState<string>('TODOS');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'missing' | 'repeated' | 'owned'>('TODOS');

  // Active chat session
  const [activeChat, setActiveChat] = useState<{
    chatId: string;
    partnerId: string;
    partnerName: string;
    partnerWhatsapp?: string;
  } | null>(null);

  const [loadingDemo, setLoadingDemo] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const triggerNotification = (title: string, description: string) => {
    const toastId = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [
      {
        id: toastId,
        title,
        description,
        partnerUid: 'system',
        partnerName: 'Notificação do Sistema'
      },
      ...prev
    ]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 7500);
  };

  // Administrative / Simulation dashboard states
  const [adminSelectedUserUid, setAdminSelectedUserUid] = useState<string>('');
  const [adminNewName, setAdminNewName] = useState('');
  const [adminNewWhatsapp, setAdminNewWhatsapp] = useState('');
  const [adminNewEmail, setAdminNewEmail] = useState('');
  const [adminChatSender, setAdminChatSender] = useState('demo_jimi_copa');
  const [adminChatMessageText, setAdminChatMessageText] = useState('');

  // Import / Export Feature States
  const [showImportExport, setShowImportExport] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'export' | 'import'>('export');
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedExport, setCopiedExport] = useState(false);
  const [exportType, setExportType] = useState<'repeated' | 'missing'>('repeated');
  const [isImporting, setIsImporting] = useState(false);
  const prevDoubleMatchUidsRef = useRef<string[] | null>(null);

  // Search & Custom interactive marking layout states
  const [searchText, setSearchText] = useState('');
  const [fastAddCode, setFastAddCode] = useState('');
  const [fastAddError, setFastAddError] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({ BRA: true, FIFA: true });
  const [selectedStickerByTeam, setSelectedStickerByTeam] = useState<Record<string, string>>({});
  const [isProgressDetailsExpanded, setIsProgressDetailsExpanded] = useState(false);
  const [progressSearch, setProgressSearch] = useState('');

  // 0. Clean Open-as-Visitor Boot-up Rule
  useEffect(() => {
    const isFirstInit = !sessionStorage.getItem('copa_is_initialized');
    if (isFirstInit) {
      sessionStorage.setItem('copa_is_initialized', 'true');
      localStorage.removeItem('copa_sticker_bypass_user');
      localStorage.removeItem('copa_stickers_local_visitante');
      signOut(auth).catch(() => {});
    }
  }, []);

  // 0b. Automatic database background cleanup for demo/sandbox records
  useEffect(() => {
    if (!user) return;
    
    const runDatabaseCleanupObj = async () => {
      const jimiId = 'demo_jimi_copa';
      const ritaId = 'demo_rita_copa';
      const diegoId = 'demo_diego_copa';
      
      try {
        console.log("Automatic Firestore cleaning of demo/test profiles running...");
        await deleteDoc(doc(db, 'users', jimiId)).catch(() => {});
        await deleteDoc(doc(db, 'users', ritaId)).catch(() => {});
        await deleteDoc(doc(db, 'users', diegoId)).catch(() => {});

        // Clean systematic demo user stickers
        const targetIds = [
          `${jimiId}_BRA1`, `${jimiId}_ARG3`, `${jimiId}_FWC1`, `${jimiId}_FRA3`, `${jimiId}_BRA3`, `${jimiId}_POR3`, `${jimiId}_ESP3`,
          `${ritaId}_BRA3`, `${ritaId}_POR3`, `${ritaId}_USA1`, `${ritaId}_ARG3`, `${ritaId}_FWC1`, `${ritaId}_BRA1`,
          `${diegoId}_ECU1`, `${diegoId}_URU3`, `${diegoId}_COL1`, `${diegoId}_BRA1`, `${diegoId}_FWC1`
        ];
        for (const id of targetIds) {
          await deleteDoc(doc(db, 'user_stickers', id)).catch(() => {});
        }
      } catch (e) {
        console.error("Auto cleanup background error:", e);
      }
    };
    
    runDatabaseCleanupObj();
  }, [user?.uid]);

  // 1. Auth Subscription
  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (firebaseUser) {
        // Fetch full profile details
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        unsubUserDoc = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setUser({
              uid: data.uid,
              displayName: data.displayName,
              email: data.email,
              photoURL: data.photoURL,
              whatsapp: data.whatsapp,
              createdAt: data.createdAt?.toDate()?.toISOString() || ''
            });
          } else {
            // fallback
            setUser({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Colecionador(a)',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || '',
              createdAt: new Date().toISOString()
            });
          }
          setAuthLoading(false);
        }, (err) => {
          console.error("User doc snapshot error:", err);
          if (!firebaseUser.uid.startsWith('demo_')) {
            handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
          }
        });
      } else {
        setUser(null);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) {
        unsubUserDoc();
      }
    };
  }, []);

  // 2. Real-time sticker database state (only if authenticated)
  useEffect(() => {
    if (!user) return;

    // Sub to all global stickers records to compute matches
    const stickersRef = collection(db, 'user_stickers');
    const unsubStickers = onSnapshot(stickersRef, (snapshot) => {
      const records: UserSticker[] = [];
      const myMap: Record<string, UserSticker> = {};

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rec: UserSticker = {
          id: docSnap.id,
          userId: data.userId,
          userDisplayName: data.userDisplayName || 'Colecionador',
          stickerId: data.stickerId,
          status: data.status,
          quantity: data.quantity || 1,
          updatedAt: typeof data.updatedAt?.toDate === 'function'
            ? data.updatedAt.toDate().toISOString()
            : (data.updatedAt || '')
        };

        records.push(rec);

        if (data.userId === user.uid) {
          myMap[data.stickerId] = rec;
        }
      });

      // Local/offline/demo mode bypass injection
      let finalMyMap = myMap;
      let finalRecords = records;

      if (user.uid.startsWith('demo_')) {
        const localStr = localStorage.getItem(`copa_stickers_local_${user.uid}`);
        if (localStr) {
          try {
            const localMap = JSON.parse(localStr);
            finalMyMap = localMap;
            const filteredRemote = records.filter(r => r.userId !== user.uid);
            finalRecords = [...filteredRemote, ...(Object.values(localMap) as UserSticker[])];
          } catch (e) {
            console.error("Erro ao ler figurinhas demo locais:", e);
          }
        } else {
          let defaultMap: Record<string, UserSticker> = {};
          if (user.uid === 'demo_jimi_copa') {
            defaultMap = DEFAULT_JIMI_STICKERS;
          } else if (user.uid === 'demo_rita_copa') {
            defaultMap = DEFAULT_RITA_STICKERS;
          } else if (user.uid === 'demo_diego_copa') {
            defaultMap = DEFAULT_DIEGO_STICKERS;
          }
          finalMyMap = defaultMap;
          const filteredRemote = records.filter(r => r.userId !== user.uid);
          finalRecords = [...filteredRemote, ...(Object.values(defaultMap) as UserSticker[])];
        }
      }

      setAllStickersRecords(finalRecords);
      setMyStickers(finalMyMap);
    }, (err) => {
      // Ignore list permission errors if in guest/demo mode
      if (!user.uid.startsWith('demo_')) {
        handleFirestoreError(err, OperationType.LIST, 'user_stickers');
      }
    });

    // Sub to all users in the system to fetch details of target traders
    const usersRef = collection(db, 'users');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
      const usersMap: Record<string, UserProfile> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        usersMap[docSnap.id] = {
          uid: docSnap.id,
          displayName: data.displayName || 'Colecionador(a)',
          email: data.email || '',
          photoURL: data.photoURL,
          whatsapp: data.whatsapp,
          createdAt: ''
        };
      });
      setAllUsers(usersMap);
    }, (err) => {
      if (!user.uid.startsWith('demo_')) {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    });

    // Sub to chats (secured query)
    const chatsRef = collection(db, 'chats');
    const qChats = query(chatsRef, where('participants', 'array-contains', user.uid));
    const unsubChats = onSnapshot(qChats, (snapshot) => {
      const myChats: Chat[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const participants = data.participants as string[];
        myChats.push({
          id: docSnap.id,
          participants,
          participantDetails: data.participantDetails || {},
          lastMessage: data.lastMessage || '',
          lastMessageAt: data.lastMessageAt?.toDate()?.toISOString() || '',
          lastSenderId: data.lastSenderId || ''
        });
      });
      // Sort chats by date
      myChats.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      setChats(myChats);
    }, (err) => {
      if (!user.uid.startsWith('demo_')) {
        handleFirestoreError(err, OperationType.LIST, 'chats');
      }
    });

    return () => {
      unsubStickers();
      unsubUsers();
      unsubChats();
    };
  }, [user]);

  // Handle Mark / Change sticker status
  const handleSetStickerStatus = async (stickerId: string, status: 'missing' | 'repeated' | 'owned') => {
    if (!user) return;

    // Local / Offline storage tracking for demo users
    if (user.uid.startsWith('demo_')) {
      const currentMap = { ...myStickers };
      const current = currentMap[stickerId];
      const currentStatus = current ? current.status : 'missing';
      const isSameStatus = currentStatus === status;

      if (isSameStatus || status === 'missing') {
        delete currentMap[stickerId];
      } else {
        currentMap[stickerId] = {
          id: `${user.uid}_${stickerId}`,
          userId: user.uid,
          userDisplayName: user.displayName || 'Colecionador',
          stickerId: stickerId,
          status: status,
          quantity: status === 'repeated' ? (current?.quantity || 1) : 1,
          updatedAt: new Date().toISOString()
        };
      }

      localStorage.setItem(`copa_stickers_local_${user.uid}`, JSON.stringify(currentMap));
      setMyStickers(currentMap);
      setAllStickersRecords(prev => {
        const filtered = prev.filter(r => r.userId !== user.uid);
        return [...filtered, ...(Object.values(currentMap) as UserSticker[])];
      });
      return;
    }

    const recordId = `${user.uid}_${stickerId}`;
    const docRef = doc(db, 'user_stickers', recordId);
    
    const current = myStickers[stickerId];
    // If there's no record in DB, the sticker's effective status is 'missing'
    const currentStatus = current ? current.status : 'missing';
    const isSameStatus = currentStatus === status;

    try {
      if (isSameStatus) {
        // Toggle off: deleting the document returns it to the default 'missing' state
        await deleteDoc(docRef);
      } else {
        if (status === 'missing') {
          // Marking as 'missing' can simply delete the document, as the default state is 'missing'
          await deleteDoc(docRef);
        } else {
          // Set owned or repeated status properly
          await setDoc(docRef, {
            id: recordId,
            userId: user.uid,
            userDisplayName: user.displayName || 'Colecionador',
            stickerId: stickerId,
            status: status,
            quantity: status === 'repeated' ? (current?.quantity || 1) : 1,
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `user_stickers/${recordId}`);
    }
  };

  const handleIncrementQuantity = async (stickerId: string, delta: number) => {
    if (!user) return;

    const current = myStickers[stickerId];
    if (!current || current.status !== 'repeated') return;

    const newQty = Math.max(1, (current.quantity || 1) + delta);

    if (user.uid.startsWith('demo_')) {
      const currentMap = { ...myStickers };
      if (currentMap[stickerId]) {
        currentMap[stickerId] = {
          ...currentMap[stickerId],
          quantity: newQty,
          updatedAt: new Date().toISOString()
        };
      }
      localStorage.setItem(`copa_stickers_local_${user.uid}`, JSON.stringify(currentMap));
      setMyStickers(currentMap);
      setAllStickersRecords(prev => {
        const filtered = prev.filter(r => r.userId !== user.uid);
        return [...filtered, ...(Object.values(currentMap) as UserSticker[])];
      });
      return;
    }

    const recordId = `${user.uid}_${stickerId}`;
    const docRef = doc(db, 'user_stickers', recordId);

    try {
      await setDoc(docRef, {
        quantity: newQty,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `user_stickers/${recordId}`);
    }
  };

  const handleBulkApply = async (
    scope: 'album' | 'filtered' | 'team',
    status: 'missing' | 'repeated' | 'owned',
    targetTeamCode?: string
  ) => {
    if (!user) {
      triggerNotification("Aviso 💡", "Você precisa estar conectado ou usar o Modo Visitante para realizar esta ação.");
      return;
    }

    setBulkLoading(true);

    try {
      let targetStickers: Sticker[] = [];

      if (scope === 'album') {
        targetStickers = STICKERS;
      } else if (scope === 'team') {
        const code = targetTeamCode || selectedTeam;
        targetStickers = STICKERS.filter(s => s.teamCode === code);
      } else {
        // 'filtered': Match active filters
        targetStickers = STICKERS.filter(s => {
          // match Group
          if (selectedGroup !== 'TODOS') {
            if (selectedGroup === 'ESPECIAIS') {
              if (s.teamCode !== 'FIFA' && s.teamCode !== 'COCA') return false;
            } else {
              const teamObj = TEAMS.find(t => t.code === s.teamCode);
              if (!teamObj || teamObj.group !== selectedGroup) return false;
            }
          }
          // match Team
          if (selectedTeam !== 'TODOS' && s.teamCode !== selectedTeam) {
            return false;
          }
          // match Search Text
          if (searchText.trim()) {
            const q = searchText.toLowerCase().trim();
            const teamObj = TEAMS.find(t => t.code === s.teamCode);
            const teamName = teamObj ? teamObj.name.toLowerCase() : '';
            const teamCode = s.teamCode.toLowerCase();
            const stickerName = s.name.toLowerCase();
            const stickerId = s.id.toLowerCase();
            const matchesSearch = 
              teamName.includes(q) || 
              teamCode.includes(q) || 
              stickerName.includes(q) || 
              stickerId.includes(q);
            if (!matchesSearch) return false;
          }
          return true;
        });
      }

      if (targetStickers.length === 0) {
        triggerNotification("Aviso 💡", "Nenhuma figurinha corresponde ao escopo selecionado.");
        setBulkLoading(false);
        return;
      }

      const updatedMyStickers = { ...myStickers };

      // Local / Offline Storage integration for Demo users
      if (user.uid.startsWith('demo_')) {
        targetStickers.forEach((s) => {
          const recordId = `${user.uid}_${s.id}`;
          const quantity = myStickers[s.id]?.quantity || 1;

          if (status === 'missing') {
            delete updatedMyStickers[s.id];
          } else {
            updatedMyStickers[s.id] = {
              id: recordId,
              userId: user.uid,
              userDisplayName: user.displayName || 'Colecionador',
              stickerId: s.id,
              status: status,
              quantity: status === 'repeated' ? quantity : 1,
              updatedAt: new Date().toISOString()
            };
          }
        });

        localStorage.setItem(`copa_stickers_local_${user.uid}`, JSON.stringify(updatedMyStickers));
        setMyStickers(updatedMyStickers);

        const otherRecords = allStickersRecords.filter(r => r.userId !== user.uid);
        setAllStickersRecords([...otherRecords, ...Object.values(updatedMyStickers)]);

        const statusText = status === 'owned' ? 'Tenho' : status === 'repeated' ? 'Repetida' : 'Falta';
        triggerNotification(
          "Sucesso! ✔️", 
          `Aplicado status '${statusText}' em lote para ${targetStickers.length} figurinhas localmente.`
        );
        return;
      }

      // Online Firestore Flow - Chunking to 400 records per batch
      const CHUNK_SIZE = 400;
      const chunks: Sticker[][] = [];
      for (let i = 0; i < targetStickers.length; i += CHUNK_SIZE) {
        chunks.push(targetStickers.slice(i, i + CHUNK_SIZE));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((s) => {
          const recordId = `${user.uid}_${s.id}`;
          const docRef = doc(db, 'user_stickers', recordId);
          const quantity = myStickers[s.id]?.quantity || 1;

          if (status === 'missing') {
            batch.delete(docRef);
            delete updatedMyStickers[s.id];
          } else {
            batch.set(docRef, {
              id: recordId,
              userId: user.uid,
              userDisplayName: user.displayName || 'Colecionador',
              stickerId: s.id,
              status: status,
              quantity: status === 'repeated' ? quantity : 1,
              updatedAt: serverTimestamp()
            }, { merge: true });

            updatedMyStickers[s.id] = {
              id: recordId,
              userId: user.uid,
              userDisplayName: user.displayName || 'Colecionador',
              stickerId: s.id,
              status: status,
              quantity: status === 'repeated' ? quantity : 1,
              updatedAt: new Date().toISOString()
            };
          }
        });
        await batch.commit();
      }

      setMyStickers(updatedMyStickers);
      const otherRecords = allStickersRecords.filter(r => r.userId !== user.uid);
      setAllStickersRecords([...otherRecords, ...Object.values(updatedMyStickers)]);

      const statusText = status === 'owned' ? 'Tenho' : status === 'repeated' ? 'Repetida' : 'Falta';
      triggerNotification(
        "Sucesso! 🔥", 
        `Aplicado status '${statusText}' em lote para ${targetStickers.length} figurinhas na nuvem.`
      );
    } catch (error) {
      console.error("Bulk apply failed:", error);
      triggerNotification("Erro de conexão ⚠️", "Não foi possível aplicar as alterações em lote de forma persistente.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkSetTeam = async (teamCode: string, action: 'owned' | 'missing' | 'repeated') => {
    await handleBulkApply('team', action, teamCode);
  };

  const generateExportText = (type: 'repeated' | 'missing'): string => {
    const tipoLabel = type === 'repeated' ? 'repetidas' : 'faltantes';
    const intro = `Olá, estas são minhas figurinhas ${tipoLabel}:`;

    let list: { stickerId: string; quantity: number }[] = [];
    if (type === 'repeated') {
      list = (Object.values(myStickers) as UserSticker[])
        .filter(us => us.status === 'repeated' && us.quantity > 0)
        .map(us => ({ stickerId: us.stickerId, quantity: us.quantity }));
    } else {
      // type === 'missing'
      // Get all stickers in the catalog that are either not present in our map or explicitly marked as missing
      list = STICKERS.filter(s => {
        const entry = myStickers[s.id];
        return !entry || entry.status === 'missing';
      }).map(s => ({ stickerId: s.id, quantity: 1 }));
    }

    if (list.length === 0) {
      return `${intro}\n\n(Nenhuma figurinha marcada como ${tipoLabel} ainda)`;
    }

    // Group by teamCode
    const groups: Record<string, { stickerId: string; num: number; qty: number }[]> = {};
    list.forEach(item => {
      const originalSt = STICKERS.find(s => s.id === item.stickerId);
      const team = originalSt ? originalSt.teamCode : 'FIFA';
      const num = originalSt ? originalSt.number : 0;
      const qty = item.quantity || 1;
      
      if (!groups[team]) {
        groups[team] = [];
      }
      groups[team].push({ stickerId: item.stickerId, num, qty });
    });

    // Sort team codes based on album order (FIFA, then TEAMS order)
    const sortedTeams = Object.keys(groups).sort((a, b) => {
      const idxA = a === 'FIFA' ? -1 : TEAMS.findIndex(t => t.code === a);
      const idxB = b === 'FIFA' ? -1 : TEAMS.findIndex(t => t.code === b);
      const orderA = idxA !== -1 ? idxA : 999;
      const orderB = idxB !== -1 ? idxB : 999;
      return orderA - orderB;
    });
    const lines = sortedTeams.map(team => {
      const sortedItems = groups[team].sort((a, b) => a.num - b.num);
      const itemsStr = sortedItems.map(it => type === 'repeated' ? `${it.stickerId}(${it.qty}x)` : it.stickerId).join(', ');
      return `${team}: ${itemsStr}`;
    });

    return `${intro}\n${lines.join('\n')}`;
  };

  const handleImportStickersSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      triggerNotification("Perfil Necessário 👤", "Por favor, faça login antes de importar.");
      return;
    }
    if (!importText.trim()) {
      triggerNotification("Entrada Vazia 📝", "Por favor, cole um texto com figurinhas.");
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const lines = importText.split('\n');
      
      // Auto-detect status from first line or headers
      let statusToSet: 'repeated' | 'missing' = 'repeated';
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes('repetidas') || lower.includes('tenho')) {
          statusToSet = 'repeated';
          break;
        } else if (lower.includes('faltantes') || lower.includes('falta') || lower.includes('preciso') || lower.includes('quero')) {
          statusToSet = 'missing';
          break;
        }
      }

      const parsedStickers: { stickerId: string; quantity: number }[] = [];
      const validStickerIds = new Set(STICKERS.map(s => s.id));
      let invalidCount = 0;
      const ignoredCodes: string[] = [];

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        const match = line.match(/^([A-Za-z0-9-]+)\s*:\s*(.*)$/);
        if (match) {
          const teamCode = match[1].toUpperCase();
          const listStr = match[2];

          // parse patterns like: BRA1(2x) or FWC5(1x) or just 1(2x)
          const stickerRegex = /([A-Za-z]+)?(\d+)(?:\s*\(\s*(\d+)\s*x?\s*\))?/g;
          let stickMatch;
          while ((stickMatch = stickerRegex.exec(listStr)) !== null) {
            const letterPrefix = stickMatch[1] ? stickMatch[1].toUpperCase() : '';
            const numStr = stickMatch[2];
            const qty = stickMatch[3] ? parseInt(stickMatch[3], 10) : 1;

            let stickerId = '';
            if (letterPrefix) {
              stickerId = `${letterPrefix}${parseInt(numStr, 10)}`;
              if (numStr === '00') {
                stickerId = '00';
              }
            } else {
              if (teamCode === 'FIFA' || teamCode === 'SPECIAL') {
                if (numStr === '00' || numStr === '0') {
                  stickerId = '00';
                } else {
                  stickerId = `FWC${parseInt(numStr, 10)}`;
                }
              } else {
                stickerId = `${teamCode}${parseInt(numStr, 10)}`;
              }
            }

            if (validStickerIds.has(stickerId)) {
              parsedStickers.push({ stickerId, quantity: qty });
            } else {
              const fallbackId = `${teamCode}${parseInt(numStr, 10)}`;
              if (validStickerIds.has(fallbackId)) {
                parsedStickers.push({ stickerId: fallbackId, quantity: qty });
              } else {
                invalidCount++;
                if (ignoredCodes.length < 5) {
                  ignoredCodes.push(stickerId || numStr);
                }
              }
            }
          }
        } else {
          // No colon on this line! Try to parse raw sticker codes with explicit team prefixes (like BRA1, CAN2, FWC5)
          const stickerRegex = /([A-Za-z]+)(\d+)(?:\s*\(\s*(\d+)\s*x?\s*\))?/g;
          let stickMatch;
          while ((stickMatch = stickerRegex.exec(line)) !== null) {
            const letterPrefix = stickMatch[1].toUpperCase();
            const numStr = stickMatch[2];
            const qty = stickMatch[3] ? parseInt(stickMatch[3], 10) : 1;

            let stickerId = `${letterPrefix}${parseInt(numStr, 10)}`;
            if (numStr === '00') {
              stickerId = '00';
            }

            if (validStickerIds.has(stickerId)) {
              parsedStickers.push({ stickerId, quantity: qty });
            } else {
              // Try replacing 'FIFA' or 'SPECIAL' prefix with 'FWC' if applicable
              if (letterPrefix === 'FIFA' || letterPrefix === 'SPECIAL') {
                const altId = `FWC${parseInt(numStr, 10)}`;
                if (validStickerIds.has(altId)) {
                  parsedStickers.push({ stickerId: altId, quantity: qty });
                  continue;
                }
              }
              invalidCount++;
              if (ignoredCodes.length < 5) {
                ignoredCodes.push(`${letterPrefix}${numStr}`);
              }
            }
          }
        }
      }

      if (parsedStickers.length === 0) {
        setImportResult({
          success: false,
          message: "Nenhuma figurinha recomendada ou válida foi encontrada no texto colado. Certifique-se de que o formato está parecido com: 'BRA: BRA1(1x), BRA5(2x)'."
        });
        setIsImporting(false);
        return;
      }

      // Local / Offline Storage integration for Visitor/Demo users
      if (user.uid.startsWith('demo_')) {
        const updatedMyStickers = { ...myStickers };
        if (statusToSet === 'missing') {
          const importedSet = new Set(parsedStickers.map(item => item.stickerId));

          if (importMode === 'replace') {
            // Replace mode: listed ones are missing (deleted), and the remaining ones in the album are owned (or kept repeated)
            for (const s of STICKERS) {
              const recordId = `${user.uid}_${s.id}`;
              const current = myStickers[s.id];

              if (importedSet.has(s.id)) {
                // Delete to default back to missing
                delete updatedMyStickers[s.id];
              } else {
                // Not in missing list -> set to owned status unless it already has repeated status
                const currentStatus = current?.status;
                if (currentStatus === 'repeated') {
                  updatedMyStickers[s.id] = {
                    id: recordId,
                    userId: user.uid,
                    userDisplayName: user.displayName || 'Colecionador',
                    stickerId: s.id,
                    status: 'repeated',
                    quantity: current.quantity || 1,
                    updatedAt: new Date().toISOString()
                  };
                } else {
                  updatedMyStickers[s.id] = {
                    id: recordId,
                    userId: user.uid,
                    userDisplayName: user.displayName || 'Colecionador',
                    stickerId: s.id,
                    status: 'owned',
                    quantity: 1,
                    updatedAt: new Date().toISOString()
                  };
                }
              }
            }
          } else {
            // Merge mode: only delete/mark as missing the ones provided in parsedStickers
            for (const item of parsedStickers) {
              delete updatedMyStickers[item.stickerId];
            }
          }
        } else {
          // statusToSet === 'repeated'
          if (importMode === 'replace') {
            // Delete existing ones of this status
            const existingOfStatus = (Object.values(myStickers) as UserSticker[]).filter(us => us.status === statusToSet);
            for (const es of existingOfStatus) {
              delete updatedMyStickers[es.stickerId];
            }
          }

          // Add/Update keys
          for (const item of parsedStickers) {
            const recordId = `${user.uid}_${item.stickerId}`;
            updatedMyStickers[item.stickerId] = {
              id: recordId,
              userId: user.uid,
              userDisplayName: user.displayName || 'Colecionador',
              stickerId: item.stickerId,
              status: statusToSet,
              quantity: item.quantity,
              updatedAt: new Date().toISOString()
};
          }
        }

        localStorage.setItem(`copa_stickers_local_${user.uid}`, JSON.stringify(updatedMyStickers));
        setMyStickers(updatedMyStickers);

        const otherRecords = allStickersRecords.filter(r => r.userId !== user.uid);
        setAllStickersRecords([...otherRecords, ...Object.values(updatedMyStickers)]);

        const statusLabel = statusToSet === 'repeated' ? 'Repetidas' : 'Faltantes';
        let message = `Sucesso! Importadas ${parsedStickers.length} figurinhas como "${statusLabel}" (${importMode === 'replace' ? 'Substituindo' : 'Mesclando'} com suas figurinhas anteriores de mesmo tipo) no Modo Visitante.`;
        if (invalidCount > 0) {
          message += ` Nota: ${invalidCount} figurinhas (como ${ignoredCodes.join(', ')}${invalidCount > 5 ? '...' : ''}) foram ignoradas pois não pertencem a este álbum oficial.`;
        }

        setImportResult({ success: true, message });
        setImportText('');
        setIsImporting(false);
        return;
      }

      // We perform database persistence batch writes for authenticated users
      const batchList: any[] = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      if (statusToSet === 'missing') {
        const importedSet = new Set(parsedStickers.map(item => item.stickerId));

        if (importMode === 'replace') {
          // Replace mode: listed ones are missing (deleted), and the remaining ones in the album are owned (or kept repeated)
          for (const s of STICKERS) {
            const recordId = `${user.uid}_${s.id}`;
            const docRef = doc(db, 'user_stickers', recordId);
            const current = myStickers[s.id];

            if (importedSet.has(s.id)) {
              // Delete to default back to missing
              currentBatch.delete(docRef);
            } else {
              // Not in missing list -> set to owned status unless it already has repeated status
              const currentStatus = current?.status;
              if (currentStatus === 'repeated') {
                currentBatch.set(docRef, {
                  id: recordId,
                  userId: user.uid,
                  userDisplayName: user.displayName || 'Colecionador',
                  stickerId: s.id,
                  status: 'repeated',
                  quantity: current.quantity || 1,
                  updatedAt: serverTimestamp()
                }, { merge: true });
              } else {
                currentBatch.set(docRef, {
                  id: recordId,
                  userId: user.uid,
                  userDisplayName: user.displayName || 'Colecionador',
                  stickerId: s.id,
                  status: 'owned',
                  quantity: 1,
                  updatedAt: serverTimestamp()
                }, { merge: true });
              }
            }

            opCount++;
            if (opCount >= 400) {
              batchList.push(currentBatch);
              currentBatch = writeBatch(db);
              opCount = 0;
            }
          }
        } else {
          // Merge mode: only delete/mark as missing the ones provided in parsedStickers
          for (const item of parsedStickers) {
            const recordId = `${user.uid}_${item.stickerId}`;
            const docRef = doc(db, 'user_stickers', recordId);
            currentBatch.delete(docRef);

            opCount++;
            if (opCount >= 400) {
              batchList.push(currentBatch);
              currentBatch = writeBatch(db);
              opCount = 0;
            }
          }
        }
      } else {
        // statusToSet === 'repeated'
        if (importMode === 'replace') {
          const existingOfStatus = (Object.values(myStickers) as UserSticker[]).filter(us => us.status === statusToSet);
          for (const es of existingOfStatus) {
            const docRef = doc(db, 'user_stickers', es.id);
            currentBatch.delete(docRef);
            opCount++;
            if (opCount >= 400) {
              batchList.push(currentBatch);
              currentBatch = writeBatch(db);
              opCount = 0;
            }
          }
        }

        // Add/Update keys
        for (const item of parsedStickers) {
          const recordId = `${user.uid}_${item.stickerId}`;
          const docRef = doc(db, 'user_stickers', recordId);

          currentBatch.set(docRef, {
            id: recordId,
            userId: user.uid,
            userDisplayName: user.displayName || 'Colecionador',
            stickerId: item.stickerId,
            status: statusToSet,
            quantity: item.quantity,
            updatedAt: serverTimestamp()
          }, { merge: true });

          opCount++;
          if (opCount >= 400) {
            batchList.push(currentBatch);
            currentBatch = writeBatch(db);
            opCount = 0;
          }
        }
      }

      if (opCount > 0) {
        batchList.push(currentBatch);
      }

      // Commit batches
      for (const b of batchList) {
        await b.commit();
      }

      const statusLabel = statusToSet === 'repeated' ? 'Repetidas' : 'Faltantes';
      let message = `Sucesso! Importadas ${parsedStickers.length} figurinhas como "${statusLabel}" (${importMode === 'replace' ? 'Substituindo' : 'Mesclando'} com suas figurinhas anteriores de mesmo tipo).`;
      if (invalidCount > 0) {
        message += ` Nota: ${invalidCount} figurinhas (como ${ignoredCodes.join(', ')}${invalidCount > 5 ? '...' : ''}) foram ignoradas pois não pertencem a este álbum oficial.`;
      }

      setImportResult({ success: true, message });
      setImportText('');
    } catch (err: any) {
      console.error(err);
      setImportResult({ success: false, message: `Erro ao importar: ${err.message || 'Erro desconhecido'}` });
    } finally {
      setIsImporting(false);
    }
  };

  // ==========================================
  // PAINEL ADMINISTRATIVO & SIMULADOR HANDLERS
  // ==========================================
  const handleAdminAddRandomPack = (targetUid: string, type: 'repeated' | 'missing', count: number) => {
    const currentStr = localStorage.getItem(`copa_stickers_local_${targetUid}`);
    let currentRecords: Record<string, UserSticker> = {};
    if (currentStr) {
      try { currentRecords = JSON.parse(currentStr); } catch (e) {}
    }

    let added = 0;
    const shuffled = [...STICKERS].sort(() => 0.5 - Math.random());
    for (const s of shuffled) {
      if (added >= count) break;
      if (!currentRecords[s.id] || currentRecords[s.id].status !== type) {
        currentRecords[s.id] = {
          id: `${targetUid}_${s.id}`,
          userId: targetUid,
          userDisplayName: allUsers[targetUid]?.displayName || user?.displayName || 'Colecionador(a)',
          stickerId: s.id,
          status: type,
          quantity: type === 'repeated' ? Math.floor(Math.random() * 3) + 1 : 1,
          updatedAt: new Date().toISOString()
        };
        added++;
      }
    }

    localStorage.setItem(`copa_stickers_local_${targetUid}`, JSON.stringify(currentRecords));
    
    if (user && targetUid === user.uid) {
      setMyStickers(currentRecords);
    }

    const updatedAllStickers: UserSticker[] = [];
    Object.keys(allUsers).forEach((uid) => {
      const uStr = localStorage.getItem(`copa_stickers_local_${uid}`);
      if (uStr) {
        try {
          const parsed = JSON.parse(uStr);
          updatedAllStickers.push(...(Object.values(parsed) as UserSticker[]));
        } catch (e) {}
      } else {
        if (uid === 'demo_jimi_copa') {
          updatedAllStickers.push(...(Object.values(DEFAULT_JIMI_STICKERS) as UserSticker[]));
        } else if (uid === 'demo_rita_copa') {
          updatedAllStickers.push(...(Object.values(DEFAULT_RITA_STICKERS) as UserSticker[]));
        } else if (uid === 'demo_diego_copa') {
          updatedAllStickers.push(...(Object.values(DEFAULT_DIEGO_STICKERS) as UserSticker[]));
        }
      }
    });

    if (user && !allUsers[targetUid] && targetUid === user.uid) {
      updatedAllStickers.push(...(Object.values(currentRecords) as UserSticker[]));
    }

    setAllStickersRecords(updatedAllStickers);
  };

  const handleAdminClearStickers = (targetUid: string) => {
    localStorage.removeItem(`copa_stickers_local_${targetUid}`);
    if (user && targetUid === user.uid) {
      setMyStickers({});
    }
    
    const updatedAllStickers: UserSticker[] = [];
    Object.keys(allUsers).forEach((uid) => {
      const uStr = localStorage.getItem(`copa_stickers_local_${uid}`);
      if (uStr) {
        try {
          const parsed = JSON.parse(uStr);
          updatedAllStickers.push(...(Object.values(parsed) as UserSticker[]));
        } catch (e) {}
      } else {
        if (uid === 'demo_jimi_copa') {
          updatedAllStickers.push(...(Object.values(DEFAULT_JIMI_STICKERS) as UserSticker[]));
        } else if (uid === 'demo_rita_copa') {
          updatedAllStickers.push(...(Object.values(DEFAULT_RITA_STICKERS) as UserSticker[]));
        } else if (uid === 'demo_diego_copa') {
          updatedAllStickers.push(...(Object.values(DEFAULT_DIEGO_STICKERS) as UserSticker[]));
        }
      }
    });
    setAllStickersRecords(updatedAllStickers);
  };

  const handleImpersonate = (targetUser: UserProfile) => {
    setUser(targetUser);
    localStorage.setItem('copa_sticker_bypass_user', JSON.stringify(targetUser));
    setActiveTab('album');
    
    const toastId = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [
      {
        id: toastId,
        title: "Usuário Alterado! 👤",
        description: `Visualizando como: ${targetUser.displayName}`,
        partnerUid: targetUser.uid,
        partnerName: targetUser.displayName
      },
      ...prev
    ]);
  };

  const handleCreateCustomUser = () => {
    if (!adminNewName.trim() || !user) return;
    const newUid = `custom_sim_${Math.random().toString(36).substring(2, 9)}`;
    const newProfile: UserProfile = {
      uid: newUid,
      displayName: adminNewName.trim(),
      email: adminNewEmail.trim() || `${adminNewName.toLowerCase().replace(/\s+/g, '')}@sim.app`,
      whatsapp: adminNewWhatsapp.trim() || '11900000555',
      photoURL: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${newUid}`,
      createdAt: new Date().toISOString()
    };

    const customUsersStr = localStorage.getItem('copa_custom_simulated_users');
    let customUsers: Record<string, UserProfile> = {};
    if (customUsersStr) {
      try { customUsers = JSON.parse(customUsersStr); } catch (e) {}
    }

    customUsers[newUid] = newProfile;
    localStorage.setItem('copa_custom_simulated_users', JSON.stringify(customUsers));

    setAllUsers(prev => ({
      ...prev,
      [newUid]: newProfile
    }));

    setAdminNewName('');
    setAdminNewWhatsapp('');
    setAdminNewEmail('');
  };

  const handleSendSimulatedMessage = () => {
    if (!adminChatMessageText.trim() || !user) return;
    const senderProfile = allUsers[adminChatSender];
    if (!senderProfile) return;

    const sortedUids = [user.uid, adminChatSender].sort();
    const chatIdCombined = `${sortedUids[0]}_${sortedUids[1]}`;

    const chatMsgKey = `copa_messages_local_${chatIdCombined}`;
    const currentMessagesStr = localStorage.getItem(chatMsgKey) || '[]';
    let messagesList = [];
    try { messagesList = JSON.parse(currentMessagesStr); } catch (e) {}

    const newMsg = {
      id: `msg_sim_${Date.now()}`,
      chatId: chatIdCombined,
      senderId: adminChatSender,
      senderName: senderProfile.displayName,
      text: adminChatMessageText.trim(),
      createdAt: new Date().toISOString()
    };
    messagesList.push(newMsg);
    localStorage.setItem(chatMsgKey, JSON.stringify(messagesList));

    const chatListKey = `copa_chats_list_local_${user.uid}`;
    const currentChatsStr = localStorage.getItem(chatListKey) || '[]';
    let chatsList: Chat[] = [];
    try { chatsList = JSON.parse(currentChatsStr); } catch (e) {}

    const existingChatIdx = chatsList.findIndex(c => c.id === chatIdCombined);
    if (existingChatIdx >= 0) {
      chatsList[existingChatIdx].lastMessage = adminChatMessageText.trim();
      chatsList[existingChatIdx].lastMessageAt = new Date().toISOString();
      chatsList[existingChatIdx].lastSenderId = adminChatSender;
    } else {
      chatsList.push({
        id: chatIdCombined,
        participants: [user.uid, adminChatSender],
        participantDetails: {
          [user.uid]: { displayName: user.displayName, photoURL: user.photoURL, whatsapp: user.whatsapp },
          [adminChatSender]: { displayName: senderProfile.displayName, photoURL: senderProfile.photoURL, whatsapp: senderProfile.whatsapp }
        },
        lastMessage: adminChatMessageText.trim(),
        lastMessageAt: new Date().toISOString(),
        lastSenderId: adminChatSender
      });
    }
    localStorage.setItem(chatListKey, JSON.stringify(chatsList));
    setChats(chatsList);

    const toastId = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [
      {
        id: toastId,
        title: `Nova mensagem de ${senderProfile.displayName} 💬`,
        description: adminChatMessageText.trim(),
        partnerUid: adminChatSender,
        partnerName: senderProfile.displayName,
        partnerWhatsapp: senderProfile.whatsapp
      },
      ...prev
    ]);

    setAdminChatMessageText('');
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      localStorage.removeItem('copa_sticker_bypass_user');
      await signOut(auth);
      setUser(null);
      triggerNotification("Sessão Encerrada 👋", "Você encerrou sua sessão com sucesso.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleFastAddRepeated = (e: React.FormEvent) => {
    e.preventDefault();
    setFastAddError(null);
    if (!fastAddCode.trim() || !user) return;

    // Split by comma in case user enters multiple
    const codes = fastAddCode.toUpperCase().split(',').map(c => c.trim()).filter(Boolean);
    let addedCount = 0;
    let ignoredCount = 0;

    const updatedMyStickers = { ...myStickers };

    codes.forEach(code => {
      const foundSticker = STICKERS.find(s => s.id === code);
      if (foundSticker) {
        const current = updatedMyStickers[code];
        if (current && current.status === 'repeated') {
          updatedMyStickers[code] = {
            ...current,
            quantity: (current.quantity || 1) + 1,
            updatedAt: new Date().toISOString()
          };
        } else {
          updatedMyStickers[code] = {
            id: `${user.uid}_${code}`,
            userId: user.uid,
            userDisplayName: user.displayName || 'Colecionador',
            stickerId: code,
            status: 'repeated',
            quantity: 1,
            updatedAt: new Date().toISOString()
          };
        }
        addedCount++;

        const recordId = `${user.uid}_${code}`;
        const docRef = doc(db, 'user_stickers', recordId);
        setDoc(docRef, {
          id: recordId,
          userId: user.uid,
          userDisplayName: user.displayName || 'Colecionador',
          stickerId: code,
          status: 'repeated',
          quantity: updatedMyStickers[code].quantity || 1,
          updatedAt: serverTimestamp()
        }).catch(err => handleFirestoreError(err, OperationType.WRITE, `user_stickers/${recordId}`));
      } else {
        ignoredCount++;
      }
    });

    if (addedCount > 0) {
      setMyStickers(updatedMyStickers);
      setFastAddCode('');
      triggerNotification("Adicionado! 🔄", `Adicionada(s) ${addedCount} figurinha(s) repetida(s) ao estoque.`);
    }

    if (ignoredCount > 0) {
      setFastAddError(`Nota: ${ignoredCount} código(s) ignorado(s) por não existirem no álbum oficial.`);
    }
  };

  // Start real-time chat room with another user
  const handleStartChat = (partnerUid: string) => {
    if (!user) return;
    const partnerProfile = allUsers[partnerUid];
    const partnerName = partnerProfile?.displayName || 'Colecionador';
    
    // Sort UIDs alphabetically to get unique chatId
    const chatId = user.uid < partnerUid ? `${user.uid}_${partnerUid}` : `${partnerUid}_${user.uid}`;
    
    setActiveChat({
      chatId,
      partnerId: partnerUid,
      partnerName,
      partnerWhatsapp: partnerProfile?.whatsapp
    });
    setActiveTab('chats');
  };

  // Demo Data Generator for direct interaction and visual feedback!
  const handleGenerateDemoData = async () => {
    if (!user) return;
    setLoadingDemo(true);

    try {
      // 1. Create simulated users
      const jimiId = 'demo_jimi_copa';
      const ritaId = 'demo_rita_copa';
      const diegoId = 'demo_diego_copa';

      const demoUsers = [
        {
          uid: jimiId,
          displayName: 'Jimi Hendrix (Demo)',
          email: 'jimi@copa2026.app',
          whatsapp: '11988880001',
          photoURL: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=jimi'
        },
        {
          uid: ritaId,
          displayName: 'Rita Lee (Demo)',
          email: 'rita@copa2026.app',
          whatsapp: '21977770002',
          photoURL: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=rita'
        },
        {
          uid: diegoId,
          displayName: 'Diego Maradona (Demo)',
          email: 'diego@copa2026.app',
          whatsapp: '31966660003',
          photoURL: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=diego'
        }
      ];

      // Write users to database
      for (const dUser of demoUsers) {
        await setDoc(doc(db, 'users', dUser.uid), {
          uid: dUser.uid,
          displayName: dUser.displayName,
          email: dUser.email,
          whatsapp: dUser.whatsapp,
          photoURL: dUser.photoURL,
          createdAt: serverTimestamp()
        });
      }

      // 2. Generate systematic stickers for demo users to guarantee matches with the client!
      // Jimi has repeated: BRA-01 (Escudo), ARG-01 (Messi has ARG-03), FIFA-01 (Mascot), FRA-03 (Mbappe)
      // Jimi is missing: BRA-03 (Vinicius), POR-03 (Ronaldo)
      // Rita has repeated: BRA-03, POR-03, USA-01
      // Rita is missing: ARG-03 (Messi), FIFA-01
      // Diego has repeated: ECU-01, URU-03, COL-01
      // Diego is missing: BRA-01
 
      const demoStickers = [
        // Jimi Hendrix
        { id: `${jimiId}_BRA1`, userId: jimiId, userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'BRA1', status: 'repeated', quantity: 2 },
        { id: `${jimiId}_ARG3`, userId: jimiId, userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'ARG3', status: 'repeated', quantity: 1 },
        { id: `${jimiId}_FWC1`, userId: jimiId, userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'FWC1', status: 'repeated', quantity: 3 },
        { id: `${jimiId}_FRA3`, userId: jimiId, userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'FRA3', status: 'repeated', quantity: 1 },
        
        { id: `${jimiId}_BRA3`, userId: jimiId, userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'BRA3', status: 'missing', quantity: 1 },
        { id: `${jimiId}_POR3`, userId: jimiId, userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'POR3', status: 'missing', quantity: 1 },
        { id: `${jimiId}_ESP3`, userId: jimiId, userDisplayName: 'Jimi Hendrix (Demo)', stickerId: 'ESP3', status: 'missing', quantity: 1 },

        // Rita Lee
        { id: `${ritaId}_BRA3`, userId: ritaId, userDisplayName: 'Rita Lee (Demo)', stickerId: 'BRA3', status: 'repeated', quantity: 1 },
        { id: `${ritaId}_POR3`, userId: ritaId, userDisplayName: 'Rita Lee (Demo)', stickerId: 'POR3', status: 'repeated', quantity: 2 },
        { id: `${ritaId}_USA1`, userId: ritaId, userDisplayName: 'Rita Lee (Demo)', stickerId: 'USA1', status: 'repeated', quantity: 1 },
        
        { id: `${ritaId}_ARG3`, userId: ritaId, userDisplayName: 'Rita Lee (Demo)', stickerId: 'ARG3', status: 'missing', quantity: 1 },
        { id: `${ritaId}_FWC1`, userId: ritaId, userDisplayName: 'Rita Lee (Demo)', stickerId: 'FWC1', status: 'missing', quantity: 1 },
        { id: `${ritaId}_BRA1`, userId: ritaId, userDisplayName: 'Rita Lee (Demo)', stickerId: 'BRA1', status: 'missing', quantity: 1 },

        // Diego Maradona
        { id: `${diegoId}_ECU1`, userId: diegoId, userDisplayName: 'Diego Maradona (Demo)', stickerId: 'ECU1', status: 'repeated', quantity: 1 },
        { id: `${diegoId}_URU3`, userId: diegoId, userDisplayName: 'Diego Maradona (Demo)', stickerId: 'URU3', status: 'repeated', quantity: 1 },
        { id: `${diegoId}_COL1`, userId: diegoId, userDisplayName: 'Diego Maradona (Demo)', stickerId: 'COL1', status: 'repeated', quantity: 2 },
        
        { id: `${diegoId}_BRA1`, userId: diegoId, userDisplayName: 'Diego Maradona (Demo)', stickerId: 'BRA1', status: 'missing', quantity: 1 },
        { id: `${diegoId}_FWC1`, userId: diegoId, userDisplayName: 'Diego Maradona (Demo)', stickerId: 'FWC1', status: 'missing', quantity: 1 }
      ];

      for (const dSticker of demoStickers) {
        await setDoc(doc(db, 'user_stickers', dSticker.id), {
          id: dSticker.id,
          userId: dSticker.userId,
          userDisplayName: dSticker.userDisplayName,
          stickerId: dSticker.stickerId,
          status: dSticker.status,
          quantity: dSticker.quantity,
          updatedAt: serverTimestamp()
        });
      }

      // Write a friendly first direct message to help test!
      const testChatIdStr = user.uid < jimiId ? `${user.uid}_${jimiId}` : `${jimiId}_${user.uid}`;
      await setDoc(doc(db, 'chats', testChatIdStr), {
        id: testChatIdStr,
        participants: [user.uid, jimiId],
        participantDetails: {
          [user.uid]: { displayName: user.displayName },
          [jimiId]: { displayName: 'Jimi Hendrix (Demo)', whatsapp: '11988880001' }
        },
        lastMessage: 'Fala garoto! Vi no painel que temos figurinhas para trocar exatamente em 1x1. Topa?',
        lastMessageAt: serverTimestamp(),
        lastSenderId: jimiId
      });

      await setDoc(doc(db, `chats/${testChatIdStr}/messages`, `msg_welcome_${Date.now()}`), {
        id: `msg_welcome_${Date.now()}`,
        chatId: testChatIdStr,
        senderId: jimiId,
        senderName: 'Jimi Hendrix (Demo)',
        text: 'Fala garoto! Vi no painel que temos figurinhas para trocar exatamente em 1x1. Topa?',
        createdAt: serverTimestamp()
      });

      triggerNotification("Demonstração Ativa 🚀", "Ambiente de testes inicializado! Os matches simulados foram criados na aba 'Matches de Troca' e um chat de boas-vindas foi aberto.");
      setActiveTab('matches');
    } catch (error) {
      console.error(error);
      triggerNotification("Erro de Configuração ❌", "Erro ao criar colecionadores de demonstração: " + error);
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleClearDemoData = async () => {
    if (!user) return;
    setLoadingDemo(true);
    try {
      const jimiId = 'demo_jimi_copa';
      const ritaId = 'demo_rita_copa';
      const diegoId = 'demo_diego_copa';

      // Delete demo users and their respective stickers
      const targetIds = [
        `${jimiId}_BRA1`, `${jimiId}_ARG3`, `${jimiId}_FWC1`, `${jimiId}_FRA3`, `${jimiId}_BRA3`, `${jimiId}_POR3`, `${jimiId}_ESP3`,
        `${ritaId}_BRA3`, `${ritaId}_POR3`, `${ritaId}_USA1`, `${ritaId}_ARG3`, `${ritaId}_FWC1`, `${ritaId}_BRA1`,
        `${diegoId}_ECU1`, `${diegoId}_URU3`, `${diegoId}_COL1`, `${diegoId}_BRA1`, `${diegoId}_FWC1`
      ];

      for (const id of targetIds) {
        await deleteDoc(doc(db, 'user_stickers', id));
      }

      await deleteDoc(doc(db, 'users', jimiId));
      await deleteDoc(doc(db, 'users', ritaId));
      await deleteDoc(doc(db, 'users', diegoId));

      triggerNotification("Limpeza Concluída 🧹", "Dados de demonstração e simuladores removidos com sucesso!");
    } catch (e) {
      console.error(e);
      triggerNotification("Erro de Limpeza ❌", "Erro ao limpar dados de demonstração: " + e);
    } finally {
      setLoadingDemo(false);
    }
  };

  // 3. Compute Matches (Algoritmo Real de Trocas de Figurinhas)
  // Let's analyze.
  // Other users' records
  const partnerRecords = allStickersRecords.filter(r => r.userId !== user?.uid);
  
  // My missing sticker codes
  const myMissingStickerIds = STICKERS.filter(s => !myStickers[s.id] || myStickers[s.id]?.status === 'missing').map(s => s.id);
  // My repeated stickers codes
  const myRepeatedStickerIds = STICKERS.filter(s => myStickers[s.id]?.status === 'repeated').map(s => s.id);

  // Partners grouping by UID
  const partnerRecordsByUid: Record<string, UserSticker[]> = {};
  partnerRecords.forEach((rec) => {
    if (!partnerRecordsByUid[rec.userId]) {
      partnerRecordsByUid[rec.userId] = [];
    }
    partnerRecordsByUid[rec.userId].push(rec);
  });

  // Calculate: Double Matches & Single Matches
  const doubleMatchesList: DoubleMatch[] = [];
  const singleMatchesList: SingleMatch[] = [];

  Object.entries(partnerRecordsByUid).forEach(([partnerId, records]) => {
    const partnerProfile = allUsers[partnerId];
    if (!partnerProfile) return;

    const partnerStickerMap = records.reduce((acc, r) => {
      acc[r.stickerId] = r;
      return acc;
    }, {} as Record<string, UserSticker>);

    const partnerMissing = STICKERS.filter(s => {
      const r = partnerStickerMap[s.id];
      return !r || r.status === 'missing';
    }).map(s => s.id);

    const partnerRepeated = records.filter(r => r.status === 'repeated').map(r => r.stickerId);

    // Single: They have what I miss
    const theyHaveMyMissing = partnerRepeated.filter(id => myMissingStickerIds.includes(id));
    // Single: I have what they miss
    const iHaveTheirMissing = myRepeatedStickerIds.filter(id => partnerMissing.includes(id));

    // Populate Single Match records
    theyHaveMyMissing.forEach((sid) => {
      const stk = STICKERS.find(s => s.id === sid);
      singleMatchesList.push({
        stickerId: sid,
        stickerName: stk ? `${stk.teamCode} ${stk.number} - ${stk.name}` : sid,
        partnerUid: partnerId,
        partnerName: partnerProfile.displayName,
        partnerWhatsapp: partnerProfile.whatsapp,
        type: 'he_has_my_missing'
      });
    });

    iHaveTheirMissing.forEach((sid) => {
      const stk = STICKERS.find(s => s.id === sid);
      singleMatchesList.push({
        stickerId: sid,
        stickerName: stk ? `${stk.teamCode} ${stk.number} - ${stk.name}` : sid,
        partnerUid: partnerId,
        partnerName: partnerProfile.displayName,
        partnerWhatsapp: partnerProfile.whatsapp,
        type: 'i_have_his_missing'
      });
    });

    // Double Match (Perfect match): 
    // They have some of my missing AND I have some of their missing!
    if (theyHaveMyMissing.length > 0 && iHaveTheirMissing.length > 0) {
      doubleMatchesList.push({
        partnerUid: partnerId,
        partnerName: partnerProfile.displayName,
        partnerWhatsapp: partnerProfile.whatsapp,
        myRepeated: iHaveTheirMissing, // what I give to them
        myMissing: theyHaveMyMissing   // what they give to me
      });
    }
  });

  // Real-time tracking of new perfect matches
  const doubleMatchPartnerIds = doubleMatchesList.map(m => m.partnerUid).sort().join(',');

  useEffect(() => {
    if (!user) {
      prevDoubleMatchUidsRef.current = null;
      return;
    }
    // Wait until both stickers and users are loaded to avoid false positives
    if (allStickersRecords.length === 0 || Object.keys(allUsers).length === 0) {
      return;
    }

    const currentPartnerIds = doubleMatchesList.map(m => m.partnerUid);

    if (prevDoubleMatchUidsRef.current === null) {
      // Initialize with currently existing matches so we don't spam toasts on mount
      prevDoubleMatchUidsRef.current = currentPartnerIds;
      return;
    }

    // Find if there is any partnerUid in currentPartnerIds that WAS NOT in prevDoubleMatchUidsRef.current
    const newMatches = doubleMatchesList.filter(m => !prevDoubleMatchUidsRef.current!.includes(m.partnerUid));

    if (newMatches.length > 0) {
      newMatches.forEach((match) => {
        const toastId = Math.random().toString(36).substring(2, 9);
        const newToast: ToastNotification = {
          id: toastId,
          title: "Novo Match Duplo! 🤝",
          description: `Você e ${match.partnerName} têm figurinhas para trocar reciprocamente!`,
          partnerUid: match.partnerUid,
          partnerName: match.partnerName,
          partnerWhatsapp: match.partnerWhatsapp,
          myRepeated: match.myRepeated,
          myMissing: match.myMissing
        };
        setToasts(prev => {
          // Prevent duplicates in current active toasts
          if (prev.some(t => t.partnerUid === match.partnerUid)) return prev;
          return [newToast, ...prev];
        });

        // Auto-remove toast after 10 seconds
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toastId));
        }, 10000);
      });
    }

    // Update the ref
    prevDoubleMatchUidsRef.current = currentPartnerIds;
  }, [doubleMatchPartnerIds, user?.uid, allStickersRecords.length, Object.keys(allUsers).length]);


  // 4. Counts indicators
  const totalStickersCount = STICKERS.length;
  const countedMissing = STICKERS.filter(s => !myStickers[s.id] || myStickers[s.id]?.status === 'missing').length;
  const countedRepeated = STICKERS.filter(s => myStickers[s.id]?.status === 'repeated').length;
  const totalRepeatedSum = STICKERS.reduce((acc, s) => {
    const rec = myStickers[s.id];
    return acc + (rec?.status === 'repeated' ? (rec.quantity || 1) : 0);
  }, 0);
  // Owned contains stickers that I own: default neither missing nor repeated, meaning (allStickers - missing) or counted
  // To keep it clean, let's say "Tenho" is any sticker that is not marked as missing. Wait, if it is marked as repeated, I have it.
  // If it is unmarked, it means I don't have it tracked yet, or I already have it? 
  // Let's track completion percentage as percentage of stickers we OWN (Owned = totalStickersCount - missing).
  const completionPercentage = Math.round(((totalStickersCount - countedMissing) / totalStickersCount) * 100);

  // Calculate album progress details grouped by category/team
  const progressBySection = [
    {
      code: 'FIFA',
      name: 'FIFA Especiais',
      flagUrl: '✨',
      stickers: STICKERS_BY_TEAM['FIFA'] || []
    },
    ...TEAMS.map(t => ({
      code: t.code,
      name: t.name,
      flagUrl: t.flagUrl,
      stickers: STICKERS_BY_TEAM[t.code] || []
    }))
  ].map(section => {
    const total = section.stickers.length;
    const missing = section.stickers.filter(s => !myStickers[s.id] || myStickers[s.id]?.status === 'missing').length;
    const obtained = total - missing;
    const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0;
    return {
      ...section,
      total,
      obtained,
      percentage
    };
  });

  // 5. Render States
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mb-4"></div>
        <p className="text-sm font-semibold tracking-wide text-slate-400">Carregando Estádio...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth onSuccess={() => setActiveTab('album')} />;
  }

  const isAdminUser = user && (user.email === 'admin@teste.com' || user.email === 'admin@copa2026.app' || user.email?.startsWith('admin_') || user.uid === 'admin');

  // Filter stickers in the main album catalog tab
  const getFilteredStickers = () => {
    let result = [...STICKERS];

    if (selectedGroup !== 'TODOS') {
      const teamsInGroup = TEAMS.filter(t => t.group === selectedGroup).map(t => t.code);
      result = result.filter(s => teamsInGroup.includes(s.teamCode) || (selectedGroup === 'ESPECIAIS' && (s.teamCode === 'FIFA' || s.teamCode === 'COCA')));
    }

    if (selectedTeam !== 'TODOS') {
      result = result.filter(s => s.teamCode === selectedTeam);
    }

    if (statusFilter !== 'TODOS') {
      if (statusFilter === 'missing') {
        result = result.filter(s => !myStickers[s.id] || myStickers[s.id]?.status === 'missing');
      } else if (statusFilter === 'repeated') {
        result = result.filter(s => myStickers[s.id]?.status === 'repeated');
      } else if (statusFilter === 'owned') {
        result = result.filter(s => myStickers[s.id]?.status === 'owned' || myStickers[s.id]?.status === 'repeated');
      }
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase().trim();
      result = result.filter(s => {
        const team = TEAMS.find(t => t.code === s.teamCode);
        return (
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (team && team.name.toLowerCase().includes(q))
        );
      });
    }

    return result;
  };

  const filteredStickers = getFilteredStickers();

  return (
    <div className="min-h-screen bg-gradient-to-tr from-sky-50/50 via-emerald-50/40 to-amber-50/50 text-slate-800 font-sans flex flex-col">
      
      {/* Dynamic Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-emerald-100 sticky top-0 z-50 shadow-sm text-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo Title */}
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="trofeu">🏆</span>
            <div>
              <h1 className="font-extrabold text-base tracking-tight sm:text-lg flex items-center gap-1.5 text-slate-900">
                Álbum Copa 2026 
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2' py-0.5 rounded-full border border-emerald-200 font-bold font-mono">
                  TROCA BRASIL
                </span>
              </h1>
              <p className="text-[10px] text-slate-500 font-semibold">Encontre trocas perfeitas no seu bairro</p>
            </div>
          </div>

          {/* User Status Bar */}
          <div className="flex items-center gap-3 bg-emerald-50/70 pl-3 pr-2 py-1.5 rounded-xl border border-emerald-200/60 text-xs text-emerald-900 shadow-sm">
            <div className="flex items-center gap-2">
              <img 
                src={user.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.uid}`} 
                alt="Profile" 
                className="w-6 h-6 rounded-lg bg-emerald-100 border border-emerald-200"
                referrerPolicy="no-referrer"
              />
              <span className="font-bold text-emerald-955 max-w-[100px] sm:max-w-none truncate">{user.displayName}</span>
            </div>
            
            <div className="h-4 w-px bg-emerald-200"></div>

            <button 
              type="button"
              onClick={handleLogout}
              className="p-1 rounded-lg text-emerald-700 hover:text-red-650 hover:bg-red-50/60 transition cursor-pointer"
              title="Sair"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col md:flex-row gap-5">
        
        {/* Navigation Sidebar Drawer */}
        <aside className="w-full md:w-64 flex flex-col gap-4">
          
          {/* Main Tabs Selection */}
          <nav className="bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-sm flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible">
            <button
              type="button"
              id="tab_album"
              onClick={() => setActiveTab('album')}
              className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === 'album' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-emerald-950 hover:bg-emerald-50/70'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              Meu Álbum
            </button>
            
            <button
              type="button"
              id="tab_matches"
              onClick={() => setActiveTab('matches')}
              className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-xl text-xs font-bold transition whitespace-nowrap relative cursor-pointer ${
                activeTab === 'matches' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-emerald-950 hover:bg-emerald-50/70'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              Matches de Troca
              {doubleMatchesList.length > 0 && (
                <span className="absolute top-1.5 right-1.5 md:relative md:top-auto md:right-auto md:ml-auto bg-amber-400 text-amber-950 font-black px-1.5 py-0.5 rounded-full text-[8.5px] border border-amber-500/20 animate-pulse">
                  {doubleMatchesList.length} DÚPLICE
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab_profile"
              onClick={() => setActiveTab('profile')}
              className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === 'profile' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-emerald-950 hover:bg-emerald-50/70'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              Meu Perfil
            </button>

            {isAdminUser && (
              <button
                type="button"
                id="tab_admin"
                onClick={() => setActiveTab('admin')}
                className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'admin' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'text-amber-700 hover:bg-amber-50 hover:text-amber-950 border border-dashed border-amber-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Painel Admin 👑
              </button>
            )}
          </nav>

          {/* Album Statistics Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">Progresso do Álbum</h3>
            
            {/* ProgressBar */}
            <div className="mb-4">
              <div className="flex justify-between items-end text-xs font-mono font-bold mb-1.5">
                <span className="text-emerald-600">{completionPercentage}% COMPLETO</span>
                <span className="text-slate-500">{totalStickersCount - countedMissing} / {totalStickersCount}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-550" 
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
              <div className="bg-emerald-50/60 border border-emerald-100 p-2.5 rounded-xl">
                <p className="text-emerald-800 text-[10px] font-bold">Repetidas</p>
                <p className="font-extrabold text-emerald-700 text-lg mt-0.5">+{totalRepeatedSum}</p>
              </div>
              <div className="bg-amber-50/70 border border-amber-100 p-2.5 rounded-xl">
                <p className="text-amber-800 text-[10px] font-bold">Faltando</p>
                <p className="font-extrabold text-amber-700 text-lg mt-0.5">{countedMissing}</p>
              </div>
            </div>

            {/* Detailed Selection Progress Accordion */}
            <div className="mt-4 pt-3.5 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setIsProgressDetailsExpanded(!isProgressDetailsExpanded)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-850 transition cursor-pointer select-none py-1"
              >
                <span className="flex items-center gap-1.5 justify-start">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                  Detalhes por Seleção
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-250 ${isProgressDetailsExpanded ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence initial={false}>
                {isProgressDetailsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3">
                      {/* Search category input */}
                      <div className="relative mb-2 px-0.5">
                        <input
                          type="text"
                          placeholder="Pesquisar seleção..."
                          value={progressSearch}
                          onChange={(e) => setProgressSearch(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white placeholder-slate-400 font-medium font-sans"
                        />
                        {progressSearch && (
                          <button
                            type="button"
                            onClick={() => setProgressSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold font-sans cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* List of categories progress */}
                      <div className="max-h-64 overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        {progressBySection
                          .filter(sec => 
                            sec.name.toLowerCase().includes(progressSearch.toLowerCase()) ||
                            sec.code.toLowerCase().includes(progressSearch.toLowerCase())
                          )
                          .map(sec => {
                            const labelCode = sec.code === 'FIFA' ? 'FWC' : sec.code;
                            return (
                              <div 
                                key={sec.code}
                                className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 px-1 rounded transition"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs shrink-0 select-none">{sec.flagUrl}</span>
                                  <span className="font-semibold text-slate-700 truncate">{sec.name}</span>
                                </div>
                                <div className="flex items-center gap-2 font-mono shrink-0">
                                  <span className="text-slate-500 font-medium font-mono">
                                    {labelCode} {sec.obtained}/{sec.total}
                                  </span>
                                  <span className="text-slate-400 text-[10px] font-mono">({sec.percentage}%)</span>
                                  
                                  {/* Minimal side visual bar */}
                                  <div className="w-8 bg-slate-100 h-1 rounded-full overflow-hidden shrink-0">
                                    <div 
                                      className={`h-full rounded-full ${
                                        sec.percentage === 100 
                                          ? 'bg-emerald-500' 
                                          : sec.percentage > 50 
                                          ? 'bg-sky-500' 
                                          : sec.percentage > 0 
                                          ? 'bg-amber-500' 
                                          : 'bg-slate-200'
                                      }`}
                                      style={{ width: `${sec.percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </aside>

        {/* Dynamic Display Board Area */}
        <div className="flex-1 flex flex-col gap-4">

          {/* TAB 1: MEU ÁLBUM CATALOG */}
          {activeTab === 'album' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col gap-6">

              {/* Filter Row Section */}
              <div className="flex flex-col gap-4">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-800">
                      {albumSubTab === 'selection' ? '📖 Seleção das Figurinhas do Álbum' : '🔄 Minhas Figurinhas Repetidas'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {albumSubTab === 'selection' ? 'Navegue pelas seleções da Copa 2026 e marque o seu progresso.' : 'Estoque de cópias repetidas para troca com outros colecionadores.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowImportExport(!showImportExport)}
                      className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                        showImportExport 
                          ? 'bg-emerald-600 text-white border-emerald-700' 
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      <Share2 className="w-3.5 h-3.5 shrink-0" />
                      Importar / Exportar
                    </button>
                  </div>
                </div>

                {/* PRIMARY SUB-TAB SELECTORS */}
                <div className="flex bg-slate-100/70 p-1 rounded-xl text-xs font-bold border border-slate-200 font-sans">
                  <button
                    type="button"
                    onClick={() => setAlbumSubTab('selection')}
                    className={`flex-1 py-2 text-center rounded-lg font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      albumSubTab === 'selection'
                        ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/60'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 shrink-0" />
                    📖 Seleção do Álbum
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlbumSubTab('repeated')}
                    className={`flex-1 py-2 text-center rounded-lg font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      albumSubTab === 'repeated'
                        ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/60'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Layers className={`w-4 h-4 shrink-0 ${(Object.values(myStickers) as any[]).some(s => s.status === 'repeated') ? 'text-emerald-500 font-extrabold' : ''}`} />
                    🔄 Figurinhas Repetidas
                  </button>
                </div>
              </div>

                {/* Import / Export Panel */}
                <AnimatePresence>
                  {showImportExport && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden border border-emerald-200/80 rounded-2xl bg-gradient-to-br from-emerald-50/15 via-white to-white shadow-sm"
                    >
                      <div className="p-4 md:p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                          <div className="flex items-center gap-2">
                            <Share2 className="w-4 h-4 text-emerald-600 animate-pulse" />
                            <h3 className="font-extrabold text-sm text-slate-800">Sincronizar Coleção por Texto</h3>
                          </div>
                          <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-bold font-mono border border-slate-205">
                            <button
                              type="button"
                              onClick={() => {
                                setImportExportTab('export');
                                setImportResult(null);
                              }}
                              className={`px-3 py-1 rounded-lg transition cursor-pointer font-bold ${
                                importExportTab === 'export' ? 'bg-white text-emerald-850 shadow-sm border border-slate-200/80' : 'text-slate-500'
                              }`}
                            >
                              Exportar Compartilhamento
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setImportExportTab('import');
                                setImportResult(null);
                              }}
                              className={`px-3 py-1 rounded-lg transition cursor-pointer font-bold ${
                                importExportTab === 'import' ? 'bg-white text-emerald-850 shadow-sm border border-slate-200/80' : 'text-slate-500'
                              }`}
                            >
                              Importar Lista
                            </button>
                          </div>
                        </div>

                        {importExportTab === 'export' ? (
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <span className="text-slate-500 font-semibold leading-relaxed">
                                Selecione qual conjunto de figurinhas você gostaria de exportar e copie o texto gerado para compartilhar com amigos no WhatsApp:
                              </span>
                              <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-mono font-bold shrink-0 border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExportType('repeated');
                                    setCopiedExport(false);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                    exportType === 'repeated' ? 'bg-white text-emerald-800 font-bold border border-slate-200/50 shadow-sm' : 'text-slate-500'
                                  }`}
                                >
                                  Repetidas
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExportType('missing');
                                    setCopiedExport(false);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                    exportType === 'missing' ? 'bg-white text-amber-800 font-bold border border-slate-200/50 shadow-sm' : 'text-slate-500'
                                  }`}
                                >
                                  Faltantes
                                </button>
                              </div>
                            </div>

                            <div className="relative">
                              <textarea
                                readOnly
                                value={generateExportText(exportType)}
                                className="w-full h-44 p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-700 focus:outline-none resize-none cursor-text select-all"
                              />
                              <div className="absolute bottom-3 right-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(generateExportText(exportType));
                                      setCopiedExport(true);
                                      setTimeout(() => setCopiedExport(false), 2000);
                                    } catch (err) {
                                      console.error("Copy failed", err);
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm cursor-pointer transition flex items-center gap-1.5 ${
                                    copiedExport ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-slate-100 border border-slate-250 text-slate-700'
                                  }`}
                                >
                                  {copiedExport ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" /> Copiado!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 text-slate-500" /> Copiar Texto
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={handleImportStickersSubmit} className="flex flex-col gap-4">
                            <div className="text-xs text-slate-500 font-semibold leading-relaxed">
                              Cole aqui a lista de figurinhas recebida no WhatsApp para carregar em sua coleção de uma só vez:
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                              <div className="md:col-span-8">
                                <textarea
                                  value={importText}
                                  onChange={(e) => setImportText(e.target.value)}
                                  placeholder={`Exemplo de formato para colar:\n\nOlá, estas são minhas figurinhas repetidas:\n\nCAN: 11(2x), 15(1x)\nBRA: 5(1x)\nMAR: 8(1x)`}
                                  className="w-full h-44 p-3 bg-white border border-slate-250 rounded-xl font-mono text-xs text-slate-700 focus:border-emerald-500 focus:outline-none resize-none"
                                  required
                                />
                              </div>

                              <div className="md:col-span-4 flex flex-col justify-between gap-3 p-4 bg-slate-50/70 border border-slate-200 rounded-xl text-xs">
                                <div className="space-y-3">
                                  <div>
                                    <span className="block font-mono font-bold text-[10px] text-slate-400 uppercase tracking-wide mb-1">Método de Importação</span>
                                    <div className="flex flex-col gap-1.5 mt-1 font-semibold">
                                      <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                                        <input
                                          type="radio"
                                          name="importMode"
                                          value="merge"
                                          checked={importMode === 'merge'}
                                          onChange={() => setImportMode('merge')}
                                          className="text-emerald-600 focus:ring-emerald-500"
                                        />
                                        Mesclar com coleções atuais
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                                        <input
                                          type="radio"
                                          name="importMode"
                                          value="replace"
                                          checked={importMode === 'replace'}
                                          onChange={() => setImportMode('replace')}
                                          className="text-emerald-600 focus:ring-emerald-500"
                                        />
                                        Substituir lista anterior
                                      </label>
                                    </div>
                                  </div>

                                  <div className="p-2 bg-amber-50/50 border border-amber-100 rounded-lg text-[10px] text-amber-800 leading-normal font-semibold">
                                    💡 <strong>Dica de Auto-Detecção:</strong> O app lê o texto e procura por palavras-chave como "repetidas" ou "faltantes" para saber se salvará como Repetidas ou Faltantes!
                                  </div>
                                </div>

                                <button
                                  type="submit"
                                  disabled={isImporting || !importText.trim()}
                                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-555 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                  {isImporting ? 'Importando...' : 'Confirmar Importação'}
                                </button>
                              </div>
                            </div>

                            {importResult && (
                              <div className={`p-3.5 rounded-xl text-xs border font-bold leading-relaxed ${
                                importResult.success 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                                  : 'bg-red-50 border-red-200 text-red-900'
                              }`}>
                                {importResult.message}
                              </div>
                            )}
                          </form>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              {albumSubTab === 'repeated' ? (
                <div className="flex flex-col gap-6 font-sans">
                  {/* Repeated Header */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                        <span>🔄 Controle de Figurinhas Repetidas</span>
                        <span className="animate-pulse bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] uppercase font-black px-1.5 py-0.5 rounded">Ativo</span>
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">
                        Gerencie suas cópias extras disponíveis para troca. Suas repetidas são usadas automaticamente pelo mecanismo de match!
                      </p>
                    </div>
                    <div className="bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-black text-xs px-3 py-1.5 rounded-lg font-mono border border-emerald-200 shrink-0">
                      Total: {(Object.values(myStickers) as any[]).filter(r => r.status === 'repeated').reduce((acc, curr) => acc + (curr.quantity || 1), 0)} un
                    </div>
                  </div>

                  {/* Fast Add form */}
                  <form onSubmit={handleFastAddRepeated} className="bg-slate-50/60 border border-dashed border-slate-300 p-4 rounded-2xl flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5 font-sans">
                      <label className="text-[10px] uppercase font-black tracking-wider text-slate-500">
                        ⚡ Adicionar Novas Repetidas Rapidamente
                      </label>
                      <p className="text-[10px] text-slate-400">
                        Digite o código da figurinha oficial (Ex: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-650">BRA-05</span> ou separe por vírgulas <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-650 font-bold">BRA-05, FIFA-01, URU-03</span>)
                      </p>
                    </div>

                    <div className="flex gap-2 font-sans">
                      <input
                        type="text"
                        placeholder="Código de figurinha oficial..."
                        value={fastAddCode}
                        onChange={(e) => setFastAddCode(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-slate-250 rounded-xl focus:border-emerald-500 focus:outline-none text-xs text-slate-700 font-mono"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </button>
                    </div>

                    {fastAddError && (
                      <span className="text-[10px] text-amber-600 font-extrabold">{fastAddError}</span>
                    )}
                  </form>

                  {/* Repeated Items List */}
                  {(() => {
                    const repeatedStickers = (Object.values(myStickers) as any[])
                      .filter(st => st.status === 'repeated')
                      .map(st => {
                        const originalSt = STICKERS.find(s => s.id === st.stickerId);
                        const teamInfo = TEAMS.find(t => t.code === originalSt?.teamCode);
                        return {
                          ...st,
                          originalSt,
                          teamInfo
                        };
                      })
                      .filter(item => {
                        if (!searchText.trim()) return true;
                        return item.stickerId.toLowerCase().includes(searchText.toLowerCase()) || 
                          item.originalSt?.name.toLowerCase().includes(searchText.toLowerCase()) ||
                          item.teamInfo?.name.toLowerCase().includes(searchText.toLowerCase());
                      });

                    if (repeatedStickers.length === 0) {
                      return (
                        <div className="border border-slate-150 rounded-2xl p-8 text-center text-slate-400 font-medium font-sans">
                          <p className="text-sm">Nenhuma figurinha repetida {searchText ? 'encontrada na pesquisa' : 'cadastrada'}.</p>
                          {!searchText && (
                            <p className="text-xs text-slate-400/80 mt-1.5 font-bold leading-relaxed">
                              DICA: Você pode marcar suas repetidas navegando no álbum na aba principal <strong>"📖 Seleção do Álbum"</strong> ou digitar o código delas no campo de adição rápida acima!
                            </p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 font-sans">
                        {repeatedStickers.map(item => {
                          if (!item.originalSt) return null;
                          return (
                            <div 
                              key={item.stickerId} 
                              className="border border-slate-150 rounded-xl p-3 flex items-center justify-between gap-4 bg-white shadow-xs hover:border-slate-300 transition"
                            >
                              <div className="flex items-center gap-3">
                                {/* Sticker square badge */}
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 font-mono font-black text-xs flex items-center justify-center shrink-0 font-sans">
                                  {item.originalSt.number}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                                    <span>{item.originalSt.name}</span>
                                    {item.originalSt.isSpecial && (
                                      <span className="text-[8px] bg-amber-100 text-amber-800 font-mono px-1 py-0.5 rounded font-black">SP</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1 font-sans">
                                    <span className="text-xs leading-none select-none">{item.teamInfo?.flagUrl}</span>
                                    <span>{item.teamInfo?.name} •</span>
                                    <span className="font-mono font-bold text-slate-700">{item.stickerId}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {/* Quantity Toggler */}
                                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-0.5 rounded-lg">
                                  <button
                                    type="button"
                                    onClick={() => handleIncrementQuantity(item.stickerId, -1)}
                                    className="w-5.5 h-5.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/60 text-xs font-black flex items-center justify-center cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-black font-mono w-4 text-center text-slate-800">
                                    {item.quantity || 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleIncrementQuantity(item.stickerId, 1)}
                                    className="w-5.5 h-5.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/60 text-xs font-black flex items-center justify-center cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleSetStickerStatus(item.stickerId, 'missing')}
                                  title="Remover repetida"
                                  className="p-1.5 bg-white border border-slate-200 text-slate-450 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex flex-col gap-6 font-sans">

                  {/* Status Filters Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Filtro de Status</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-bold">Mostre apenas as figurinhas marcadas com determinado status.</p>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold font-sans">
                      {(['TODOS', 'missing', 'repeated', 'owned'] as const).map((status) => {
                        const labels = { TODOS: 'Todas', missing: 'Falta 📍', repeated: 'Repetida 🔄', owned: 'Tenho ✔️' };
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs transition cursor-pointer font-bold ${
                              statusFilter === status 
                                ? 'bg-white text-emerald-800 border border-slate-205 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-850'
                            }`}
                          >
                            {labels[status]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Search Text Bar */}
                  <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Pesquise por Seleção ou Código (Ex: Brasil, BRA 1, BRA 13, CC 1...)"
                    className="w-full pl-10 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none text-xs text-slate-700 transition"
                  />
                  {searchText && (
                    <button
                      type="button"
                      onClick={() => setSearchText('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 font-semibold text-xs text-slate-400 hover:text-slate-650"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Team Dropdown Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-bold">Filtrar por Grupo</label>
                    <select
                      value={selectedGroup}
                      onChange={(e) => {
                        setSelectedGroup(e.target.value);
                        setSelectedTeam('TODOS');
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none text-xs text-slate-700 transition"
                    >
                      <option value="TODOS">🌎 Todos os Grupos & Especiais</option>
                      <option value="ESPECIAIS">💎 FIFA Especiais & Coca-Cola</option>
                      {Array.from(new Set(TEAMS.filter(t => t.group !== 'ESPECIAIS').map(t => t.group))).sort((a, b) => a.localeCompare(b)).map(grpName => {
                        const teamsInGroup = TEAMS.filter(t => t.group === grpName).map(t => t.code).join(', ');
                        return (
                          <option key={grpName} value={grpName}>
                            {grpName} ({teamsInGroup})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-bold">Filtrar por Seleção</label>
                    <select
                      value={selectedTeam}
                      onChange={(e) => {
                        setSelectedTeam(e.target.value);
                        if (e.target.value !== 'TODOS') {
                          // set group matching automatically
                          const selectedT = TEAMS.find(t => t.code === e.target.value);
                          if (selectedT) setSelectedGroup(selectedT.group);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none text-xs text-slate-700 transition"
                    >
                      <option value="TODOS">⚽ Todas as Seleções</option>
                      {selectedGroup === 'ESPECIAIS' ? (
                        <>
                          <option value="FIFA">FIFA Especiais</option>
                          <option value="COCA">Coca-Cola</option>
                        </>
                      ) : (
                        TEAMS.filter(t => selectedGroup === 'TODOS' || t.group === selectedGroup).map((t) => (
                          <option key={t.code} value={t.code}>{t.flagUrl} {t.name} ({t.code})</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {/* Unified Bulk Marking Tool Belt (Painel de Marcação em Massa) */}
                <div id="bulk-markings-panel" className="bg-gradient-to-r from-slate-50 to-slate-100/50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5 font-sans">
                      ⚡ Painel de Marcação em Lote (Massa)
                    </span>
                    {bulkLoading && (
                      <span className="text-[10.5px] text-emerald-600 font-extrabold animate-pulse flex items-center gap-1 font-mono">
                        Por favor, aguarde...
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Active Filter Scope */}
                    <div className="flex flex-col gap-2">
                      <div>
                        <span className="text-[11px] font-extrabold text-slate-700 block">Do Filtro / Busca Ativa:</span>
                        <p className="text-[9.5px] text-slate-450 mt-0.5 leading-relaxed">
                          Aplica sobre {(selectedGroup === 'TODOS' && selectedTeam === 'TODOS' && !searchText.trim()) ? 'todas' : 'as'} figurinhas que correspondem aos seus filtros ou texto de busca atual.
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 font-sans">
                        <button
                          type="button"
                          onClick={() => handleBulkApply('filtered', 'missing')}
                          disabled={bulkLoading}
                          className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-250 text-amber-850 rounded-lg text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50 cursor-pointer text-center font-sans shadow-xs flex flex-col items-center justify-center gap-0.5"
                          title="Marcar resultados do filtro ativo como Falta"
                        >
                          <span className="text-xs">📍</span>
                          <span>Falta</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkApply('filtered', 'repeated')}
                          disabled={bulkLoading}
                          className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100/80 border border-blue-250 text-blue-850 rounded-lg text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50 cursor-pointer text-center font-sans shadow-xs flex flex-col items-center justify-center gap-0.5"
                          title="Marcar resultados do filtro ativo como Repetida"
                        >
                          <span className="text-xs">🔄</span>
                          <span>Repetida</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkApply('filtered', 'owned')}
                          disabled={bulkLoading}
                          className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100/85 border border-emerald-250 text-emerald-850 rounded-lg text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50 cursor-pointer text-center font-sans shadow-xs flex flex-col items-center justify-center gap-0.5"
                          title="Marcar resultados do filtro ativo como Tenho (Sem marcação de falta/repetida)"
                        >
                          <span className="text-xs">✔️</span>
                          <span>Tenho</span>
                        </button>
                      </div>
                    </div>

                    {/* Total Album Scope */}
                    <div className="flex flex-col gap-2">
                      <div>
                        <span className="text-[11px] font-extrabold text-slate-700 block">Todo o Álbum (Geral):</span>
                        <p className="text-[9.5px] text-slate-450 mt-0.5 leading-relaxed">
                          Aplica de forma global a todas as 715 figurinhas para preenchimento rápido.
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Deseja marcar TODO O ÁLBUM (715 figurinhas) como FALTANDO? Isso sobrescreverá as marcações existentes e pode levar alguns segundos na nuvem.")) {
                              handleBulkApply('album', 'missing');
                            }
                          }}
                          disabled={bulkLoading}
                          className="px-2 py-1.5 bg-red-50 hover:bg-red-100/90 border border-red-200 text-red-900 rounded-lg text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50 cursor-pointer text-center font-sans shadow-xs flex flex-col items-center justify-center gap-0.5"
                          title="Marcar todo o álbum como Falta"
                        >
                          <span className="text-xs">📍</span>
                          <span>Falta</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Deseja marcar TODO O ÁLBUM (715 figurinhas) como REPETIDAS? Isso sobrescreverá as marcações existentes e pode levar alguns segundos na nuvem.")) {
                              handleBulkApply('album', 'repeated');
                            }
                          }}
                          disabled={bulkLoading}
                          className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100/90 border border-indigo-200 text-indigo-900 rounded-lg text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50 cursor-pointer text-center font-sans shadow-xs flex flex-col items-center justify-center gap-0.5"
                          title="Marcar todo o álbum como Repetida"
                        >
                          <span className="text-xs">🔄</span>
                          <span>Repetida</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Deseja limpar todo o seu álbum e marcar tudo como TENHO?")) {
                              handleBulkApply('album', 'owned');
                            }
                          }}
                          disabled={bulkLoading}
                          className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 border border-slate-350 text-slate-800 rounded-lg text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50 cursor-pointer text-center font-sans shadow-xs flex flex-col items-center justify-center gap-0.5"
                          title="Limpar todas as marcações de falta/repetida do álbum inteiro"
                        >
                          <span className="text-xs">✔️</span>
                          <span>Tenho</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team Quick Tool Belt */}
                {selectedTeam !== 'TODOS' && selectedTeam !== 'FIFA' && (
                  <div className="bg-sky-50/70 border border-sky-100 p-3 rounded-xl flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-xs font-bold text-sky-850">
                      Ações Rápidas por Seleção ({TEAMS.find(t => t.code === selectedTeam)?.flagUrl} {TEAMS.find(t => t.code === selectedTeam)?.name}):
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      <button 
                        type="button"
                        onClick={() => handleBulkSetTeam(selectedTeam, 'missing')}
                        disabled={bulkLoading}
                        className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200/70 border border-amber-300 text-amber-850 rounded-lg text-[10px] font-extrabold transition shadow-sm cursor-pointer"
                      >
                        Falta Todos 📍
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleBulkSetTeam(selectedTeam, 'repeated')}
                        disabled={bulkLoading}
                        className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200/70 border border-blue-300 text-blue-800 rounded-lg text-[10px] font-extrabold transition shadow-sm cursor-pointer"
                      >
                        Repetida Todos 🔄
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleBulkSetTeam(selectedTeam, 'owned')}
                        disabled={bulkLoading}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-extrabold text-slate-650 hover:text-slate-800 transition shadow-sm cursor-pointer"
                      >
                        Tenho Todos ✔️
                      </button>
                    </div>
                  </div>
                )}

              {/* Accordion List for Each Team / Specials resembling reference design strategy */}
              <div className="flex flex-col gap-3">
                {(() => {
                  const categories = [
                    { code: 'FIFA', name: 'FIFA Especiais', flagUrl: '💎', group: 'ESPECIAIS' },
                    ...TEAMS
                  ];

                  let visibleCategories = categories.filter(cat => {
                    if (selectedGroup !== 'TODOS') {
                      if (selectedGroup === 'ESPECIAIS') {
                        if (cat.code !== 'FIFA' && cat.code !== 'COCA') return false;
                      } else {
                        if (cat.group !== selectedGroup) return false;
                      }
                    }
                    if (selectedTeam !== 'TODOS') {
                      if (cat.code !== selectedTeam) return false;
                    }
                    return true;
                  });

                  if (searchText.trim()) {
                    const q = searchText.toLowerCase().trim();
                    visibleCategories = visibleCategories.filter(cat => {
                      const hasMatchingStickers = STICKERS.some(s => 
                        s.teamCode === cat.code && s.name.toLowerCase().includes(q)
                      );
                      const nameMatches = cat.name.toLowerCase().includes(q) || cat.code.toLowerCase().includes(q);
                      return nameMatches || hasMatchingStickers;
                    });
                  }

                  if (visibleCategories.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-500 bg-slate-50/50 rounded-xl border border-slate-200">
                        <p className="text-sm font-bold mb-1">Nenhuma seleção ou figurinha encontrada.</p>
                        <p className="text-xs">Tente alterar os termos de busca ou filtros.</p>
                      </div>
                    );
                  }

                  return visibleCategories.map(cat => {
                    const isExpanded = !!expandedTeams[cat.code];
                    const teamCode = cat.code;
                    const teamStickers = STICKERS.filter(s => s.teamCode === teamCode);

                    const ownedCount = teamStickers.filter(s => {
                      const state = myStickers[s.id];
                      return state && (state.status === 'owned' || state.status === 'repeated');
                    }).length;

                    const totalCount = teamStickers.length;
                    const activeStickerId = selectedStickerByTeam[teamCode] || `${teamCode}-01`;
                    const activeSticker = teamStickers.find(s => s.id === activeStickerId) || teamStickers[0];

                    return (
                      <div 
                        key={teamCode}
                        className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs transition-shadow hover:shadow-xs"
                      >
                        {/* Accordion Trigger Header */}
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedTeams(prev => ({ ...prev, [teamCode]: !prev[teamCode] }));
                          }}
                          className="w-full text-left p-3.5 flex items-center justify-between gap-4 bg-slate-50 hover:bg-slate-100/70 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl leading-none select-none">{cat.flagUrl}</span>
                            <div>
                              <span className="text-[11px] font-extrabold text-slate-400 font-mono inline-block mr-1.5">{cat.code}</span>
                              <span className="text-sm font-extrabold text-slate-800">{cat.name}</span>
                              {cat.group && cat.group !== 'ESPECIAIS' && (
                                <span className="hidden sm:inline-block ml-2 text-[10px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded font-bold">
                                  {cat.group}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-black font-mono px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg">
                              {ownedCount} / {totalCount}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-550 transition-transform duration-200 ${isExpanded ? 'transform rotate-180 text-emerald-600' : ''}`} />
                          </div>
                        </button>

                        {/* Accordion Content */}
                        {isExpanded && (
                          <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-3.5">
                            
                            {/* Dynamic Team Quick Mark Row */}
                            <div className="flex items-center justify-between flex-wrap gap-2 text-xs border-b border-dashed border-slate-200 pb-2.5">
                              <span className="font-extrabold text-slate-500 text-[10px] uppercase tracking-wide">Lote para {cat.name}:</span>
                              <div className="flex gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleBulkSetTeam(teamCode, 'missing')}
                                  disabled={bulkLoading}
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-850 text-[10px] font-black rounded-lg transition tracking-wide uppercase cursor-pointer"
                                  title="Marcar todas as figurinhas desta seleção como Falta"
                                >
                                  Marcar Falta Todas 📍
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBulkSetTeam(teamCode, 'repeated')}
                                  disabled={bulkLoading}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-850 text-[10px] font-black rounded-lg transition tracking-wide uppercase cursor-pointer"
                                  title="Marcar todas as figurinhas desta seleção como Repetidas"
                                >
                                  Marcar Repetida Todas 🔄
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBulkSetTeam(teamCode, 'owned')}
                                  disabled={bulkLoading}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-850 text-[10px] font-black rounded-lg transition tracking-wide uppercase cursor-pointer"
                                  title="Marcar todas as figurinhas desta seleção como Tenho"
                                >
                                  Marcar Tenho Todas ✔️
                                </button>
                              </div>
                            </div>

                            {/* Numbered grid of Squares */}
                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                              {teamStickers.map(sticker => {
                                const state = myStickers[sticker.id];
                                const isStickerMissing = !state || state.status === 'missing';
                                const isStickerRepeated = state?.status === 'repeated';
                                const isStickerOwned = state?.status === 'owned';

                                const matchesStatusFilter = 
                                  statusFilter === 'TODOS' ||
                                  (statusFilter === 'missing' && isStickerMissing) ||
                                  (statusFilter === 'repeated' && isStickerRepeated) ||
                                  (statusFilter === 'owned' && (isStickerOwned || isStickerRepeated));

                                const matchesSearchText = 
                                  !searchText.trim() ||
                                  sticker.name.toLowerCase().includes(searchText.toLowerCase()) ||
                                  sticker.id.toLowerCase().includes(searchText.toLowerCase());

                                const isDimmed = !matchesStatusFilter || !matchesSearchText;
                                const isSelected = sticker.id === activeStickerId;

                                // Colors representing statuses beautifully matching reference strategy
                                let bgStyle = 'bg-slate-50 border-slate-200 text-slate-455 hover:bg-slate-100 hover:text-slate-700'; 
                                if (isStickerOwned) {
                                  bgStyle = 'bg-gradient-to-tr from-emerald-50/60 to-teal-50/60 border-emerald-400 text-emerald-950';
                                } else if (state?.status === 'missing') {
                                  bgStyle = 'bg-amber-50/70 border-amber-350 text-amber-900';
                                } else if (isStickerRepeated) {
                                  bgStyle = 'bg-emerald-50 border-emerald-400 text-emerald-950';
                                }

                                return (
                                  <button
                                    key={sticker.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedStickerByTeam(prev => ({ ...prev, [teamCode]: sticker.id }));
                                    }}
                                    className={`aspect-square flex flex-col items-center justify-center rounded-xl font-mono text-center relative border transition cursor-pointer select-none ${bgStyle} ${
                                      isSelected 
                                        ? 'ring-2 ring-emerald-500 border-transparent shadow-md scale-103 font-black z-10' 
                                        : 'hover:scale-102 hover:border-slate-350'
                                    } ${isDimmed ? 'opacity-[0.25]' : 'opacity-100'}`}
                                  >
                                    <span className="text-xs font-bold">{sticker.number}</span>
                                    
                                    {/* Small corner tags for quick inspection */}
                                    {isStickerOwned && (
                                      <span className="absolute top-1 right-1 text-[8px] bg-emerald-500 text-white w-3 h-3 rounded-full flex items-center justify-center font-bold">✔️</span>
                                    )}
                                    {isStickerMissing && (
                                      <span className="absolute top-1 right-1 text-[9px]" title="Falta">📍</span>
                                    )}
                                    {isStickerRepeated && (
                                      <span className="absolute top-0.5 right-0.5 bg-emerald-600 text-white text-[8px] px-1 py-0 rounded font-sans font-black shadow-xs">
                                        +{state.quantity || 1}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Active/Selected Sticker Detail & Marking Panel */}
                            {activeSticker && (() => {
                              const activeState = myStickers[activeSticker.id];
                              const isStickerMissing = !activeState || activeState.status === 'missing';
                              const isStickerRepeated = activeState?.status === 'repeated';
                              const isStickerOwned = activeState?.status === 'owned';

                              return (
                                <div className="mt-3.5 p-3.5 bg-slate-50 border border-slate-150 rounded-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shadow-xs">
                                  {/* Info Area */}
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-xs border shadow-sm ${
                                      isStickerOwned
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                        : isStickerMissing
                                          ? 'bg-amber-55/60 border-amber-300 text-amber-800'
                                          : isStickerRepeated
                                            ? 'bg-emerald-600 border-emerald-700 text-white'
                                            : 'bg-white border-slate-200 text-slate-500'
                                    }`}>
                                      {activeSticker.number}
                                    </div>

                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`text-xs font-extrabold ${activeSticker.isSpecial ? 'text-amber-600' : 'text-slate-800'}`}>
                                          {activeSticker.name}
                                        </span>
                                        {activeSticker.isSpecial && (
                                          <span className="px-1.5 py-0.5 bg-amber-100 border border-amber-200 text-amber-800 rounded font-mono text-[8px] font-black uppercase">
                                            Brilhante
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                        Código: <span className="font-mono font-bold text-slate-700">{activeSticker.id}</span> • 
                                        Status: <span className="font-extrabold uppercase text-slate-700">
                                          {isStickerOwned ? 'Possuo' : isStickerRepeated ? `🔄 Repetida (${activeState?.quantity || 1}x)` : '📍 Falta'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Interactive Selection Toggles */}
                                  <div className="flex flex-wrap items-center gap-2.5">
                                    <div className="flex bg-white p-0.5 border border-slate-200 rounded-xl text-[10px] font-bold shadow-xs">
                                      <button
                                        type="button"
                                        onClick={() => handleSetStickerStatus(activeSticker.id, 'owned')}
                                        className={`px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                                          isStickerOwned
                                            ? 'bg-slate-800 text-white font-extrabold'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-850'
                                        }`}
                                      >
                                        Tenho
                                      </button>
                                      
                                      <button
                                        type="button"
                                        onClick={() => handleSetStickerStatus(activeSticker.id, 'missing')}
                                        className={`px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                                          isStickerMissing
                                            ? 'bg-amber-500 text-white font-extrabold'
                                            : 'text-slate-600 hover:bg-amber-50 hover:text-amber-800'
                                        }`}
                                      >
                                        Falta
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleSetStickerStatus(activeSticker.id, 'repeated')}
                                        className={`px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                                          isStickerRepeated
                                            ? 'bg-emerald-600 text-white font-extrabold'
                                            : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
                                        }`}
                                      >
                                        Repetida
                                      </button>
                                    </div>

                                    {/* Increment widget */}
                                    {isStickerRepeated && (
                                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-0.5 rounded-xl shadow-xs">
                                        <button 
                                          type="button"
                                          onClick={() => handleIncrementQuantity(activeSticker.id, -1)}
                                          className="w-5 h-5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200 cursor-pointer"
                                        >
                                          -
                                        </button>
                                        <span className="text-[11px] font-black font-mono w-4 text-center text-slate-850">
                                          {activeState.quantity || 1}
                                        </span>
                                        <button 
                                          type="button"
                                          onClick={() => handleIncrementQuantity(activeSticker.id, 1)}
                                          className="w-5 h-5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200 cursor-pointer"
                                        >
                                          +
                                        </button>
                                      </div>
                                    )}

                                    {/* Remove / Reset Button */}
                                    {activeState && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (user) {
                                            handleSetStickerStatus(activeSticker.id, 'missing')
                                              .catch(err => console.error("Error resetting sticker status: ", err));
                                          }
                                        }}
                                        className="py-1.5 px-2.5 text-[10px] text-red-500 hover:text-red-700 font-extrabold hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition cursor-pointer"
                                        title="Remover marcação"
                                      >
                                        Restaurar
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

                </div>
              )}
            </div>
          )}

          {/* TAB 2: AUTOMATIC MATCHES SCREEN */}
          {activeTab === 'matches' && (
            <div className="flex flex-col gap-5">
              
              {/* Regulamento de Valoração de Trocas (Mercado da Copinha) */}
              <div className="bg-[#FFFDF3] border border-amber-200/80 p-5 rounded-2xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -z-10"></div>
                <h3 className="text-sm font-extrabold uppercase font-mono tracking-wider text-amber-850 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-700 shrink-0" /> Regulamento de Valoração e Troca Justa (Copinha 2026)
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed font-semibold">
                  Para facilitar e enriquecer as negociações no álbum da Copa, as figurinhas do app possuem coeficientes de valoração automática baseados nas regras de troca padrão do mercado:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
                  <div className="bg-white p-3.5 rounded-xl border border-amber-100/80 flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="block font-black text-amber-900 text-xs text-amber-850">✨ Figurinhas Metalizadas</span>
                      <span className="text-[10px] text-amber-700 font-mono font-bold mt-1.5 block bg-amber-50 px-1.5 py-0.5 rounded border border-amber-150/60 w-fit">Coeficiente de Valor: 2 Pontos</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 font-mono leading-relaxed">
                      Inclui todos os Escudos das Seleções (USA1, BRA1...) e Especiais FIFA (00, FWC1 a FWC19).
                    </p>
                  </div>
                  
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-100/80 flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="block font-black text-emerald-900 text-xs text-emerald-850 font-bold">⚽ Figurinhas Normais</span>
                      <span className="text-[10px] text-emerald-700 font-mono font-bold mt-1.5 block bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150/60 w-fit">Coeficiente de Valor: 1 Ponto</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 font-mono leading-relaxed">
                      Atletas convencionais de todas as seleções e Figurinhas da Coca-Cola (CC1 a CC14) que compõem o álbum.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-sky-100 flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="block font-black text-sky-900 text-xs text-sky-850 font-bold">⚖️ Regras de Paridade de Troca</span>
                      <span className="text-[10px] text-sky-700 font-mono font-bold mt-1.5 block bg-sky-50 px-1.5 py-0.5 rounded border border-sky-150/60 w-fit">1 Metalizada = 2 Normais</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5 font-mono leading-relaxed font-semibold">
                      • Normal por Normal: as trocas são 1-por-1.<br/>
                      • Metalizada por Metalizada: as trocas são 1-por-1.
                    </p>
                  </div>
                </div>
              </div>

              {/* Perfect 1:1 Double Matches Section (BARTER DE OURO) */}
              <div className="bg-white border border-emerald-200/80 rounded-2xl p-5 shadow-sm relative overflow-hidden bg-gradient-to-tr from-emerald-50/20 via-white to-white">
                <div className="absolute top-0 right-0 px-3 py-1 bg-amber-400 text-amber-950 text-[9px] font-black uppercase font-mono tracking-wider rounded-bl-xl border-l border-b border-amber-500/20 shadow-sm">
                  🔥 Troca Perfeita (Match Duplo)
                </div>

                <div className="mb-4">
                  <h2 className="text-base font-extrabold flex items-center gap-2 text-slate-800">
                    <Sparkles className="w-5 h-5 text-amber-500 shrink-0 animate-spin-pulse" />
                    Matches Perfeitos Disponíveis ({doubleMatchesList.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl font-medium">
                    Ocorreu um match recíproco perfeito! Estas pessoas têm figurinhas que você quer, e necessitam justamente de figurinhas que você tem repetidas para trocar.
                  </p>
                </div>

                <div className="space-y-4">
                  {doubleMatchesList.map((match, idx) => {
                    const mySpecialsCount = match.myRepeated.filter(isStickerSpecial).length;
                    const myNormalsCount = match.myRepeated.length - mySpecialsCount;
                    const myValuePoints = (mySpecialsCount * 3) + myNormalsCount;

                    const partnerSpecialsCount = match.myMissing.filter(isStickerSpecial).length;
                    const partnerNormalsCount = match.myMissing.length - partnerSpecialsCount;
                    const partnerValuePoints = (partnerSpecialsCount * 3) + partnerNormalsCount;

                    const diffValue = Math.abs(myValuePoints - partnerValuePoints);

                    return (
                      <div 
                        key={match.partnerUid || idx}
                        className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm relative group hover:border-emerald-300 hover:shadow transition-all duration-300"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
                          {/* User identity & whatsapp */}
                          <div className="flex items-center gap-2.5">
                            <img 
                              src={`https://api.dicebear.com/7.x/identicon/svg?seed=${match.partnerUid}`} 
                              alt="avatar" 
                              className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200"
                            />
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-800">{match.partnerName}</h4>
                              <p className="text-[10px] text-emerald-800 font-mono font-bold flex items-center gap-1">
                                <span className="bg-emerald-100/70 px-1.5 py-0.5 rounded text-[9px] border border-emerald-200">Match Recíproco</span>
                                <span className="text-slate-300">•</span>
                                <span>{myValuePoints} pts dados vs {partnerValuePoints} pts recebidos</span>
                              </p>
                            </div>
                          </div>

                          {/* Action controllers */}
                          <div className="flex items-center gap-2">
                            {match.partnerWhatsapp && (
                              <a 
                                href={buildDoubleMatchWhatsappLink(match.partnerWhatsapp, match.partnerName, match.myRepeated, match.myMissing)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                              >
                                <Phone className="w-3.5 h-3.5 text-white animate-pulse" /> Combinar WhatsApp
                              </a>
                            )}
                          </div>
                        </div>

                        {/* swap list info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          
                          {/* what user gives */}
                          <div className="bg-emerald-50/20 p-3 rounded-lg border border-emerald-105">
                            <p className="text-[10px] text-slate-500 font-mono font-bold uppercase mb-2 flex items-center justify-between">
                              <span>Você oferece repetidas ({match.myRepeated.length}):</span>
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-205">🎁 {myValuePoints} pts</span>
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {match.myRepeated.map(id => {
                                const stk = STICKERS.find(s => s.id === id);
                                const isSpecial = isStickerSpecial(id);
                                return (
                                  <span 
                                    key={id} 
                                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold border transition ${
                                      isSpecial 
                                        ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-sm' 
                                        : 'bg-emerald-100/50 border-emerald-200/80 text-emerald-800'
                                    }`} 
                                    title={`${stk?.name || id} ${isSpecial ? '(Metalizada - 2 pts)' : '(Normal - 1 pt)'}`}
                                  >
                                    {isSpecial ? '✨ ' : ''}{id}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* what user gets */}
                          <div className="bg-amber-50/20 p-3 rounded-lg border border-amber-105">
                            <p className="text-[10px] text-slate-500 font-mono font-bold uppercase mb-2 flex items-center justify-between">
                              <span>Você quer deles ({match.myMissing.length}):</span>
                              <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-205">⭐️ {partnerValuePoints} pts</span>
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {match.myMissing.map(id => {
                                const stk = STICKERS.find(s => s.id === id);
                                const isSpecial = isStickerSpecial(id);
                                return (
                                  <span 
                                    key={id} 
                                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold border transition ${
                                      isSpecial 
                                        ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-sm' 
                                        : 'bg-slate-100 border-slate-200 text-slate-700'
                                    }`} 
                                    title={`${stk?.name || id} ${isSpecial ? '(Metalizada - 2 pts)' : '(Normal - 1 pt)'}`}
                                  >
                                    {isSpecial ? '✨ ' : ''}{id}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                        </div>

                        {/* Equivalence and Value Balance Dashboard */}
                        <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-205 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-inner">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="text-[10px] uppercase font-mono font-bold text-slate-500 tracking-wider">Análise de Balanço da Proposta</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className="text-[11px] bg-white px-2 py-1 rounded text-slate-650 border border-slate-250">
                                Seu valor: <strong className="text-emerald-700 font-extrabold">{myValuePoints} pts</strong> ({myNormalsCount}N, {mySpecialsCount}M)
                              </span>
                              <span className="text-[11px] bg-white px-2 py-1 rounded text-slate-650 border border-slate-250">
                                Valor de {match.partnerName}: <strong className="text-amber-805 font-extrabold">{partnerValuePoints} pts</strong> ({partnerNormalsCount}N, {partnerSpecialsCount}M)
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {myValuePoints === partnerValuePoints ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-850 bg-emerald-100 border border-emerald-250 px-2.5 py-1 rounded-full shadow-sm">
                                ⚖️ Valoração Equivalente (100% Justo)
                              </span>
                            ) : myValuePoints > partnerValuePoints ? (
                              <div className="flex flex-col items-end">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-250 px-2 py-0.5 rounded-full shadow-sm">
                                  📈 Você oferece +{diffValue} pts de valor
                                </span>
                                <span className="text-[9px] text-slate-500 mt-1">Dica: eles podem completar com normais para equilibrar.</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-850 bg-sky-100 border border-sky-250 px-2 py-0.5 rounded-full shadow-sm">
                                  📉 Você recebe +{diffValue} pts de valor
                                </span>
                                <span className="text-[9px] text-slate-500 mt-1">Dica: ofereça mais repetidas para equilibrar.</span>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}

                  {doubleMatchesList.length === 0 && (
                    <div className="text-center py-8 text-slate-500 font-sans text-xs">
                      Nenhum match recíproco exato de 1:1 no momento. 
                      <p className="text-[10px] text-slate-500 max-w-sm mx-auto mt-1 font-semibold">Marque mais repetidas e faltantes ou clique em "Spawnar Colecionadores (Demo)" no painel ao lado para testar!</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Passive Matches (Quem tem o que eu preciso) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-extrabold text-sm text-slate-800">Colecionadores com as Figurinhas que você precisa</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Abaixo estão listados todos os usuários do sistema que possuem repetidas correspondentes às suas figurinhas marcadas como faltantes.</p>
                </div>

                <div className="space-y-3">
                  {singleMatchesList.filter(m => m.type === 'he_has_my_missing').length === 0 ? (
                    <div className="text-center py-6 text-slate-550 text-xs font-mono bg-slate-50 border border-slate-200/60 rounded-xl">
                      Nenhuma figurinha faltante sua foi localizada nas repetidas dos demais usuários.
                    </div>
                  ) : (
                    singleMatchesList.filter(m => m.type === 'he_has_my_missing').map((match, idx) => {
                      const isSpecial = isStickerSpecial(match.stickerId);
                      return (
                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 hover:border-emerald-350 flex items-center justify-between gap-4 text-xs transition shadow-sm">
                          <div className="flex items-center gap-3">
                            <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${match.partnerUid}`} alt="avatar" className="w-7 h-7 rounded bg-emerald-50 border border-emerald-150" />
                            <div>
                              <p className="font-extrabold text-slate-800">{match.partnerName} <span className="font-mono text-[9px] text-slate-450 font-normal">tem repetida:</span></p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className={`font-mono font-black py-0.5 px-1.5 rounded inline-block text-[11px] border ${
                                  isSpecial 
                                    ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-sm' 
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                }`}>
                                  {isSpecial ? '✨ ' : ''}{match.stickerName}
                                </p>
                                <span className="text-[10px] text-slate-500 font-mono font-semibold">
                                  {isSpecial ? 'Metalizada (2 pts)' : 'Normal (1 pt)'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 shrink-0">
                            {match.partnerWhatsapp && (
                              <a 
                                href={buildSingleMatchWhatsappLink(match.partnerWhatsapp, match.partnerName, match.stickerId, match.type)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
                                title="Chamar no WhatsApp"
                              >
                                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Proactive Matches (Quem precisa do que eu tenho repetido) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-extrabold text-sm text-slate-800">Colecionadores que precisam das suas Repetidas</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Veja quem está buscando exatamente as figurinhas que você marcou como repetida na sua coleção.</p>
                </div>

                <div className="space-y-3">
                  {singleMatchesList.filter(m => m.type === 'i_have_his_missing').length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs font-mono bg-slate-50 border border-slate-100 rounded-xl">
                      Ninguém precisa de nenhuma das suas repetidas marcadas recentemente.
                    </div>
                  ) : (
                    singleMatchesList.filter(m => m.type === 'i_have_his_missing').map((match, idx) => {
                      const isSpecial = isStickerSpecial(match.stickerId);
                      return (
                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 hover:border-emerald-350 flex items-center justify-between gap-4 text-xs transition shadow-sm">
                          <div className="flex items-center gap-3">
                            <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${match.partnerUid}`} alt="avatar" className="w-7 h-7 rounded bg-emerald-50 border border-emerald-150" />
                            <div>
                              <p className="font-extrabold text-slate-800">{match.partnerName} <span className="font-mono text-[9px] text-slate-450 font-normal">precisa de:</span></p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className={`font-mono font-black py-0.5 px-1.5 rounded inline-block text-[11px] border ${
                                  isSpecial 
                                    ? 'bg-amber-100 border-amber-305 text-amber-850 shadow-sm' 
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-805'
                                }`}>
                                  {isSpecial ? '✨ ' : ''}{match.stickerName}
                                </p>
                                <span className="text-[10px] text-slate-500 font-mono font-semibold">
                                  {isSpecial ? 'Metalizada (2 pts)' : 'Normal (1 pt)'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 shrink-0">
                            {match.partnerWhatsapp && (
                              <a 
                                href={buildSingleMatchWhatsappLink(match.partnerWhatsapp, match.partnerName, match.stickerId, match.type)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 text-slate-605 rounded-lg transition-all cursor-pointer"
                                title="Chamar no WhatsApp"
                              >
                                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: PROFILE SETTINGS TABS */}
          {activeTab === 'profile' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col gap-6">
              
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">Meu Perfil de Colecionador</h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">Configure suas informações de contato para que outros trocadores possam falar diretamente com você.</p>
              </div>

              <div className="max-w-md space-y-4">
                
                {/* Visual Avatar */}
                <div className="flex items-center gap-4 bg-slate-50 p-4 border border-slate-205 rounded-xl">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.uid}`} 
                    alt="avatar" 
                    className="w-16 h-16 rounded-xl bg-white border border-slate-250 shadow shadow-slate-900/5"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800">{user.displayName}</h3>
                    <p className="text-xs text-slate-500 font-mono font-medium">{user.email}</p>
                    <div className="inline-flex mt-2 items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-250 text-emerald-800 text-[9px] font-mono font-bold">
                      ID: {user.uid.slice(0, 8)}... (Ativo)
                    </div>
                  </div>
                </div>

                {/* Profile Form (Merges / Updates on the current Profile metadata) */}
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const nameInput = (e.currentTarget.elements.namedItem('displayName') as HTMLInputElement).value;
                    const whatsappInput = (e.currentTarget.elements.namedItem('whatsapp') as HTMLInputElement).value;
                    if (!nameInput.trim()) return;

                    // Support demo / bypass / impersonated users locally
                    if (user.uid.startsWith('demo_')) {
                      const updatedUser = {
                        ...user,
                        displayName: nameInput,
                        whatsapp: whatsappInput,
                      };
                      setUser(updatedUser);
                      localStorage.setItem('copa_sticker_bypass_user', JSON.stringify(updatedUser));

                      // Also update this user in our registered users list so matches work locally
                      setAllUsers(prev => ({
                        ...prev,
                        [user.uid]: updatedUser
                      }));

                      triggerNotification("Perfil Atualizado (Demo) 👤", "Seus dados temporários de demonstração foram salvos com sucesso.");
                      return;
                    }

                    try {
                      // update in auth profile
                      if (auth.currentUser) {
                        await updateProfile(auth.currentUser, {
                          displayName: nameInput
                        });
                      }
                      
                      // update in user profile database
                      await setDoc(doc(db, 'users', user.uid), {
                        displayName: nameInput,
                        whatsapp: whatsappInput,
                        updatedAt: serverTimestamp()
                      }, { merge: true });

                      // Optimistically update the state for zero latency
                      setUser(prev => prev ? { ...prev, displayName: nameInput, whatsapp: whatsappInput } : null);

                      triggerNotification("Perfil Atualizado! 👤", "Seus dados foram salvos com sucesso e atualizados em tempo real.");
                    } catch (err) {
                      console.error(err);
                      triggerNotification("Falha no Perfil ❌", "Ocorreu um erro ao atualizar os dados do seu perfil.");
                    }
                  }}
                  className="space-y-4"
                >
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-550 mb-1 font-mono uppercase tracking-wider">Nome de Perfil / Apelido</label>
                    <input 
                      type="text" 
                      name="displayName"
                      defaultValue={user.displayName}
                      className="w-full px-4 py-2 bg-white border border-slate-250 rounded-xl focus:border-emerald-500 focus:outline-none text-xs text-slate-800 font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-550 mb-1 font-mono uppercase tracking-wider">WhatsApp para Contato Direto</label>
                    <input 
                      type="tel" 
                      name="whatsapp"
                      defaultValue={user.whatsapp || ''}
                      placeholder="Ex: 11988880001"
                      className="w-full px-4 py-2 bg-white border border-slate-250 rounded-xl focus:border-emerald-500 focus:outline-none text-xs text-slate-800 font-semibold"
                    />
                    <p className="text-[10px] text-slate-550 mt-1.5 font-medium leading-relaxed">Insira somente os números com DDD da sua cidade. Seus matches de ouro terão um botão direto para iniciar chat de troca com você no Whatsapp.</p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xs text-white transition shadow-sm cursor-pointer"
                    >
                      Salvar Alterações
                    </button>
                  </div>

                </form>

              </div>

            </div>
          )}

          {/* TAB 5: ADMIN / SIMULATION DASHBOARD */}
          {activeTab === 'admin' && isAdminUser && (
            <div className="bg-white border border-rose-100 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col gap-8">
              
              {/* Header Section */}
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-50 rounded-xl border border-amber-250/50">
                    <ShieldCheck className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-1.5">
                      Painel Administrativo da Copa 2026 👑
                      <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 py-0.5 px-2 rounded-full font-mono font-bold uppercase">
                        Simulação & Testes
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Otimize e teste fluxos de trocas perfeito, simule perfis de colecionadores e mensageria instantânea em tempo real.
                    </p>
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* COLUMN 1: USERS DIRECTORY & SWITCHER */}
                <div className="bg-slate-50/60 p-4 border border-slate-200/80 rounded-2xl flex flex-col gap-4">
                  <div>
                    <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1.5">
                      👥 Diretório de Usuários
                    </h3>
                    <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                      Visualize todos os colecionadores cadastrados. Clique em <strong>"Incorporar"</strong> para alternar sua sessão para esse perfil e testar matches automáticos cruzados!
                    </p>
                  </div>

                  {/* Users list */}
                  <div className="max-h-[300px] overflow-y-auto space-y-2.5 border border-slate-200 rounded-xl p-3 bg-white">
                    {(Object.values(allUsers) as UserProfile[]).map((u) => {
                      const isMe = u.uid === user.uid;
                      // count missing / repeated from local storage if existing
                      const uStickersStr = localStorage.getItem(`copa_stickers_local_${u.uid}`) || '';
                      let missingC = 0;
                      let repeatedC = 0;
                      if (u.uid === 'demo_jimi_copa') { missingC = 3; repeatedC = 4; }
                      else if (u.uid === 'demo_rita_copa') { missingC = 3; repeatedC = 3; }
                      else if (u.uid === 'demo_diego_copa') { missingC = 2; repeatedC = 3; }
                      
                      if (uStickersStr) {
                        try {
                          const parsed = JSON.parse(uStickersStr);
                          missingC = Object.values(parsed).filter((s: any) => s.status === 'missing').length;
                          repeatedC = Object.values(parsed).filter((s: any) => s.status === 'repeated').length;
                        } catch(e){}
                      }

                      return (
                        <div key={u.uid} className="flex items-center justify-between gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img 
                              src={u.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.uid}`} 
                              alt="User avatar" 
                              className="w-8 h-8 rounded-lg bg-emerald-100/50 border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate flex items-center gap-1">
                                {u.displayName}
                                {isMe && (
                                  <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1 rounded border border-emerald-250 font-normal">Ativo</span>
                                )}
                              </p>
                              <p className="text-[9.5px] text-slate-500 font-medium truncate">{u.whatsapp || 'Sem WhatsApp'}</p>
                              {/* sticker badge counters */}
                              <div className="flex gap-1.5 mt-1 text-[8.5px] font-mono leading-none font-bold">
                                <span className="text-emerald-700">+{repeatedC} Repetidas</span>
                                <span className="text-slate-300 font-normal">|</span>
                                <span className="text-rose-600">{missingC} Faltando</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isMe && (
                              <button
                                type="button"
                                onClick={() => handleImpersonate(u)}
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-[10px] font-bold text-slate-700 border border-slate-250 rounded-lg transition active:scale-95 cursor-pointer shadow-sm flex items-center gap-1"
                              >
                                Incorporar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add simulated User Form */}
                  <div className="border-t border-slate-200 pt-3.5 space-y-3">
                    <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">🆕 Adicionar Colecionador de Testes</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-mono font-bold text-slate-550 mb-0.5">NOME / APELIDO</label>
                        <input 
                          type="text" 
                          value={adminNewName} 
                          onChange={(e) => setAdminNewName(e.target.value)}
                          placeholder="Ex: Ayrton Senna"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-amber-550"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono font-bold text-slate-550 mb-0.5">WHATSAPP (NÚMEROS)</label>
                        <input 
                          type="text" 
                          value={adminNewWhatsapp}
                          onChange={(e) => setAdminNewWhatsapp(e.target.value)}
                          placeholder="Ex: 11999991111"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-amber-550"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <label className="block text-[9px] font-mono font-bold text-slate-550 mb-0.5">EMAIL (OPCIONAL)</label>
                        <input 
                          type="email" 
                          value={adminNewEmail}
                          onChange={(e) => setAdminNewEmail(e.target.value)}
                          placeholder="ayrton@copa2026.app"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-amber-550"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateCustomUser}
                      disabled={!adminNewName.trim()}
                      className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-250 text-white font-bold rounded-lg text-xs tracking-wide transition active:scale-95 shadow-sm cursor-pointer disabled:cursor-not-allowed"
                    >
                      Cadastrar Colecionador na Simulação
                    </button>
                  </div>

                </div>

                {/* COLUMN 2: BULK SEED DATA & SMART CHAT INJECTOR */}
                <div className="space-y-5">
                  
                  {/* CARD: STICKER PACK GENERATOR */}
                  <div className="bg-slate-50/60 p-4 border border-slate-200/80 rounded-2xl flex flex-col gap-4">
                    <div>
                      <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        📦 Gerador de Pacotinhos de Massa
                      </h3>
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">
                        Selecione um usuário cadastrado e insira volumes arbitrários de figurinhas repetidas ou colecionáveis faltantes para testar instantaneamente a mecânica de matches cruzados.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[9px] font-mono font-bold text-slate-550 mb-1">SELECIONAR USUÁRIO ALVO</label>
                        <select 
                          value={adminSelectedUserUid} 
                          onChange={(e) => setAdminSelectedUserUid(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
                        >
                          <option value="">-- {user.displayName} (Você) --</option>
                          {(Object.values(allUsers) as UserProfile[]).map((u) => (
                            <option key={u.uid} value={u.uid}>{u.displayName} ({u.uid.startsWith('demo_') ? 'Demo' : 'Custom'})</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleAdminAddRandomPack(adminSelectedUserUid || user.uid, 'repeated', 20)}
                          className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-extrabold border border-emerald-250 rounded-xl transition cursor-pointer flex flex-col items-center justify-center shadow-sm"
                        >
                          <span>Repetidas +20</span>
                          <span className="text-[9px] font-normal font-mono opacity-80">Aleatório</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdminAddRandomPack(adminSelectedUserUid || user.uid, 'missing', 20)}
                          className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-850 text-[11px] font-extrabold border border-rose-250 rounded-xl transition cursor-pointer flex flex-col items-center justify-center shadow-sm"
                        >
                          <span>Faltando +20</span>
                          <span className="text-[9px] font-normal font-mono opacity-80">Aleatório</span>
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAdminClearStickers(adminSelectedUserUid || user.uid)}
                          className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-350 text-slate-800 text-[10px] font-bold border border-slate-300 rounded-lg transition cursor-pointer"
                        >
                          Limpar Todas Figurinhas
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* CARD: CHAT MESSAGING SIMULATOR */}
                  <div className="bg-slate-50/60 p-4 border border-slate-200/80 rounded-2xl flex flex-col gap-4">
                    <div>
                      <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        💬 Simulador de Diálogo & Injeção de Chat
                      </h3>
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">
                        Selecione um dos outros usuários cadastrados e faça-o te enviar uma mensagem personalizada. Isso criará canais e mensagens em tempo real para verificar a aba "Mensagens Diretas".
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono font-bold text-slate-550 mb-1">REMETENTE SIMULADO</label>
                          <select 
                            value={adminChatSender} 
                            onChange={(e) => setAdminChatSender(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                          >
                            {(Object.values(allUsers) as UserProfile[])
                              .filter((u) => u.uid !== user.uid)
                              .map((u) => (
                                <option key={u.uid} value={u.uid}>{u.displayName}</option>
                              ))
                            }
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono font-bold text-slate-550 mb-1">DESTINATÁRIO</label>
                          <input 
                            type="text" 
                            disabled 
                            value={`${user.displayName} (Você)`}
                            className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-bold cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono font-bold text-slate-550 mb-1">MENSAGEM A ENVIAR</label>
                        <textarea 
                          rows={2}
                          value={adminChatMessageText}
                          onChange={(e) => setAdminChatMessageText(e.target.value)}
                          placeholder="Ex: Olá! Tenho a figurinha especial FIFA-01 repetida e vi que você precisa..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-amber-550 font-sans"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSendSimulatedMessage}
                        disabled={!adminChatMessageText.trim()}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-250 text-white font-extrabold rounded-xl text-xs tracking-wide transition active:scale-95 shadow cursor-pointer disabled:cursor-not-allowed"
                      >
                        Enviar Mensagem Entrada Simulada 💬
                      </button>
                    </div>

                  </div>

                </div>

              </div>

            </div>
          )}

        </div>

      </main>

      {/* Aesthetic Footer */}
      <footer className="mt-12 bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-600 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-semibold">
          <p>⚽ Matcher de Figurinhas Panini Copa do Mundo Catar-Espanha-Marrocos-América 2026</p>
          <p className="text-[10px] text-slate-500">Conectado via Firebase Firestore Real-Time Stream Cluster</p>
        </div>
      </footer>

      {/* Floating Perfect Match Toast Notifications container */}
      <div 
        id="double-match-toasts"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              id={`toast-${toast.id}`}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-white border-2 border-amber-400 rounded-xl p-4 shadow-xl flex gap-3 backdrop-blur-md"
            >
              <img 
                src={`https://api.dicebear.com/7.x/identicon/svg?seed=${toast.partnerUid}`} 
                alt="avatar" 
                className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-250 self-start shrink-0 animate-pulse"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-extrabold text-[11px] text-amber-850 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-bounce" /> Match Perfeito!
                  </span>
                  <button 
                    id={`btn-close-${toast.id}`}
                    onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    className="text-slate-400 hover:text-slate-650 transition cursor-pointer p-0.5"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-extrabold text-sm text-slate-800 mt-1 truncate">
                  {toast.partnerName}
                </p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed font-semibold">
                  Tem as figurinhas do seu álbum e busca as suas repetidas!
                </p>
                 <div className="mt-3 flex flex-wrap gap-2">
                   {toast.partnerWhatsapp && (
                     <a
                       id={`btn-wa-${toast.id}`}
                       href={buildDoubleMatchWhatsappLink(
                         toast.partnerWhatsapp,
                         toast.partnerName,
                         toast.myRepeated || [],
                         toast.myMissing || []
                       )}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
                       onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                     >
                       <Phone className="w-3 h-3 text-white" /> WhatsApp
                     </a>
                   )}
                   <button
                     id={`btn-view-${toast.id}`}
                     onClick={() => {
                       setActiveTab('matches');
                       setToasts(prev => prev.filter(t => t.id !== toast.id));
                     }}
                     className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition border border-slate-200 cursor-pointer"
                   >
                     Ver Trocas
                   </button>
                 </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
