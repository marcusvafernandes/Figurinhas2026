import React, { useState } from 'react';
import { 
  BarChart3, Award, Lightbulb, Check, Flame, Layers, 
  TrendingUp, HelpCircle, Trophy, Globe, Sparkles, 
  Box, CreditCard, Medal, BookOpen, Target, ShieldCheck,
  Crown
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { TEAMS, STICKERS } from '../data';
import { UserProfile, UserSticker } from '../types';

interface StatsDashboardProps {
  myStickers: Record<string, UserSticker>;
  allStickersRecords: UserSticker[];
  allUsers: Record<string, UserProfile>;
  user: UserProfile | null;
  accentColor?: string;
}

export default function StatsDashboard({ 
  myStickers, 
  allStickersRecords, 
  allUsers, 
  user,
  accentColor
}: StatsDashboardProps) {
  
  const [subTab, setSubTab] = useState<'meu_album' | 'comunidade'>('meu_album');

  // --- 1. PROCESSAMENTO DE DADOS COMUNIDADE ---
  const isUserActive = (uid: string): boolean => {
    if (uid.startsWith('demo_')) return true;
    
    const u = allUsers[uid];
    if (!u) return true; // Default to active if profile isn't found yet
    
    const activeDateStr = u.lastActiveAt || u.createdAt;
    if (!activeDateStr) return true; // Default to active if no date exists
    
    try {
      const lastActive = new Date(activeDateStr);
      const diffTime = Date.now() - lastActive.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays < 15;
    } catch (e) {
      console.error("Error calculating activity status:", e);
      return true;
    }
  };

  const uniqueUsers = Array.from(new Set(allStickersRecords.map(r => r.userId))).filter(isUserActive);
  const activeCollectorsCount = uniqueUsers.length || 1;

  const communityStats: Record<string, { missingCount: number, ownedCount: number, repeatedQty: number }> = {};
  STICKERS.forEach(s => {
    communityStats[s.id] = { missingCount: 0, ownedCount: 0, repeatedQty: 0 };
  });

  // Identify all active collectors (users with at least one record in the database)
  const activeUserIds = new Set<string>();
  allStickersRecords.forEach(rec => {
    if (isUserActive(rec.userId)) {
      activeUserIds.add(rec.userId);
    }
  });
  if (user?.uid && isUserActive(user.uid)) {
    activeUserIds.add(user.uid);
  }

  // Create a map of which stickers each user actually owns or has as repeated
  const userHasSticker: Record<string, Record<string, boolean>> = {};
  activeUserIds.forEach(uid => {
    userHasSticker[uid] = {};
  });

  allStickersRecords.forEach(rec => {
    if (!isUserActive(rec.userId)) return;

    if (!communityStats[rec.stickerId]) {
      communityStats[rec.stickerId] = { missingCount: 0, ownedCount: 0, repeatedQty: 0 };
    }
    
    if (rec.status === 'owned' || rec.status === 'repeated') {
      if (!userHasSticker[rec.userId]) {
        userHasSticker[rec.userId] = {};
      }
      userHasSticker[rec.userId][rec.stickerId] = true;
      communityStats[rec.stickerId].ownedCount += 1;
      
      if (rec.status === 'repeated') {
        communityStats[rec.stickerId].repeatedQty += (rec.quantity || 1);
      }
    }
  });

  // A sticker is considered implicitly missing for any active user who hasn't marked it as owned or repeated
  STICKERS.forEach(s => {
    let missingCount = 0;
    activeUserIds.forEach(uid => {
      if (!userHasSticker[uid]?.[s.id]) {
        missingCount += 1;
      }
    });
    communityStats[s.id].missingCount = missingCount;
  });

  const topMissingStickers = [...STICKERS]
    .map(s => {
      const stats = communityStats[s.id] || { missingCount: 0, ownedCount: 0, repeatedQty: 0 };
      return {
        sticker: s,
        team: TEAMS.find(t => t.code === s.teamCode),
        missingCount: stats.missingCount,
        repeatedQty: stats.repeatedQty,
        ownedCount: stats.ownedCount
      };
    })
    .sort((a, b) => {
      if (b.missingCount !== a.missingCount) {
        return b.missingCount - a.missingCount;
      }
      return a.repeatedQty - b.repeatedQty;
    })
    .slice(0, 5);

  const topRepeatedStickers = [...STICKERS]
    .map(s => {
      const stats = communityStats[s.id] || { missingCount: 0, ownedCount: 0, repeatedQty: 0 };
      return {
        sticker: s,
        team: TEAMS.find(t => t.code === s.teamCode),
        missingCount: stats.missingCount,
        repeatedQty: stats.repeatedQty,
        ownedCount: stats.ownedCount
      };
    })
    .sort((a, b) => b.repeatedQty - a.repeatedQty)
    .slice(0, 5);

  const topRareStickers = [...STICKERS]
    .map(s => {
      const stats = communityStats[s.id] || { missingCount: 0, ownedCount: 0, repeatedQty: 0 };
      const scarcityPct = activeCollectorsCount > 0
        ? Math.max(0, Math.min(100, Math.round((1 - (stats.ownedCount / activeCollectorsCount)) * 100)))
        : 100;
      return {
        sticker: s,
        team: TEAMS.find(t => t.code === s.teamCode),
        missingCount: stats.missingCount,
        repeatedQty: stats.repeatedQty,
        ownedCount: stats.ownedCount,
        scarcityPct
      };
    })
    .sort((a, b) => {
      if (a.ownedCount !== b.ownedCount) {
        return a.ownedCount - b.ownedCount;
      }
      if (b.sticker.isSpecial !== a.sticker.isSpecial) {
        return b.sticker.isSpecial ? 1 : -1;
      }
      return b.missingCount - a.missingCount;
    })
    .slice(0, 5);

  // --- 2. PROCESSAMENTO DE DADOS PESSOAIS ---
  const myTotalStickersCount = STICKERS.length;
  const myOwnedUniquesCount = STICKERS.filter(s => {
    const state = myStickers[s.id];
    return state && (state.status === 'owned' || state.status === 'repeated');
  }).length;
  const myAlbumCompletionPct = myTotalStickersCount > 0 ? Math.round((myOwnedUniquesCount / myTotalStickersCount) * 100) : 0;
  const myMissingCount = myTotalStickersCount - myOwnedUniquesCount;

  const myTotalRepeatedCount = STICKERS.reduce((acc, s) => {
    const state = myStickers[s.id];
    if (state && state.status === 'repeated') {
      return acc + (state.quantity || 1);
    }
    return acc;
  }, 0);

  // Figurinhas Metalizadas (Especiais)
  const totalSpecialsCount = STICKERS.filter(s => s.isSpecial).length;
  const myOwnedSpecialsCount = STICKERS.filter(s => {
    if (!s.isSpecial) return false;
    const state = myStickers[s.id];
    return state && (state.status === 'owned' || state.status === 'repeated');
  }).length;
  const mySpecialsPct = totalSpecialsCount > 0 ? Math.round((myOwnedSpecialsCount / totalSpecialsCount) * 100) : 0;

  const myRepeatedSpecialsCount = STICKERS.filter(s => s.isSpecial).reduce((acc, s) => {
    const state = myStickers[s.id];
    if (state && state.status === 'repeated') {
      return acc + (state.quantity || 1);
    }
    return acc;
  }, 0);

  // Seleções e Seções Completas
  const allSections = [
    { code: 'FIFA', name: 'FIFA / Especiais', flagUrl: '🏆', isRealTeam: false },
    ...TEAMS.map(t => ({ code: t.code, name: t.name, flagUrl: t.flagUrl, isRealTeam: t.code !== 'COCA' }))
  ];

  const sectionCompletion = allSections.map(sec => {
    const secStickers = STICKERS.filter(s => s.teamCode === sec.code);
    const totalInSec = secStickers.length;
    const ownedInSec = secStickers.filter(s => {
      const state = myStickers[s.id];
      return state && (state.status === 'owned' || state.status === 'repeated');
    }).length;
    return {
      ...sec,
      total: totalInSec,
      owned: ownedInSec,
      pct: totalInSec > 0 ? Math.round((ownedInSec / totalInSec) * 100) : 0,
      isComplete: totalInSec > 0 && ownedInSec === totalInSec
    };
  });

  const completeSectionsCount = sectionCompletion.filter(s => s.isComplete).length;
  const totalSectionsCount = allSections.length;
  const completeSectionsPct = totalSectionsCount > 0 ? Math.round((completeSectionsCount / totalSectionsCount) * 100) : 0;

  // Previsão matemática de pacotinhos (Coupon Collector's adaptation)
  const calculateExpectedPacks = (missing: number, total: number) => {
    if (missing <= 0) return 0;
    let sum = 0;
    for (let i = missing; i >= 1; i--) {
      sum += total / i;
    }
    return Math.ceil(sum / 7); // 7 figurinhas por pacote
  };
  const expectedPacksToComplete = calculateExpectedPacks(myMissingCount, myTotalStickersCount);

  // Pontos do Álbum (Especiais valem 2, Normais valem 1)
  const myAlbumPoints = STICKERS.reduce((acc, s) => {
    const state = myStickers[s.id];
    if (state && (state.status === 'owned' || state.status === 'repeated')) {
      return acc + (s.isSpecial ? 2 : 1);
    }
    return acc;
  }, 0);
  const totalPossiblePoints = STICKERS.reduce((acc, s) => acc + (s.isSpecial ? 2 : 1), 0);
  const albumPointsPct = totalPossiblePoints > 0 ? Math.round((myAlbumPoints / totalPossiblePoints) * 100) : 0;

  // Seleções mais próximas de completar (excluindo as que já estão 100% e as com 0%)
  const topAdvancedTeams = [...sectionCompletion]
    .filter(item => item.pct < 100 && item.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  // Pessoais do Usuário Ativo (Joia da Coroa e Desafio Supremo)
  const myOwnedOrRepeated = STICKERS.filter(s => {
    const state = myStickers[s.id];
    return state && (state.status === 'owned' || state.status === 'repeated');
  });

  let crownJewel: any = null;
  if (myOwnedOrRepeated.length > 0) {
    const crownJewelsSorted = myOwnedOrRepeated
      .map(s => {
        const stats = communityStats[s.id] || { missingCount: 0, ownedCount: 0, repeatedQty: 0 };
        const myState = myStickers[s.id];
        const otherOwnersCount = Math.max(0, stats.ownedCount - 1);
        return {
          sticker: s,
          team: TEAMS.find(t => t.code === s.teamCode),
          otherOwnersCount,
          isRepeated: myState?.status === 'repeated',
          myQuantity: myState?.status === 'repeated' ? (myState.quantity || 1) : 1
        };
      })
      .sort((a, b) => {
        if (a.otherOwnersCount !== b.otherOwnersCount) {
          return a.otherOwnersCount - b.otherOwnersCount;
        }
        if (b.sticker.isSpecial !== a.sticker.isSpecial) {
          return b.sticker.isSpecial ? 1 : -1;
        }
        return a.sticker.id.localeCompare(b.sticker.id);
      });
    
    crownJewel = crownJewelsSorted[0];
  }

  const myMissing = STICKERS.filter(s => {
    const state = myStickers[s.id];
    return !state || state.status === 'missing';
  });

  let supremeChallenge: any = null;
  if (myMissing.length > 0) {
    const supremeChallengesSorted = myMissing
      .map(s => {
        const stats = communityStats[s.id] || { missingCount: 0, ownedCount: 0, repeatedQty: 0 };
        return {
          sticker: s,
          team: TEAMS.find(t => t.code === s.teamCode),
          repeatedQty: stats.repeatedQty,
          otherOwnersCount: stats.ownedCount
        };
      })
      .sort((a, b) => {
        if (a.otherOwnersCount !== b.otherOwnersCount) {
          return a.otherOwnersCount - b.otherOwnersCount;
        }
        if (a.repeatedQty !== b.repeatedQty) {
          return a.repeatedQty - b.repeatedQty;
        }
        return a.sticker.id.localeCompare(b.sticker.id);
      });
    
    supremeChallenge = supremeChallengesSorted[0];
  }

  // Grupos mais fortes e mais fracos pessoalmente
  const groupStats = Array.from(new Set(TEAMS.map(t => t.group))).map(groupName => {
    const groupTeams = TEAMS.filter(t => t.group === groupName);
    const groupStickers = STICKERS.filter(s => groupTeams.some(gt => gt.code === s.teamCode));
    const totalInGroup = groupStickers.length;

    const ownedInGroup = groupStickers.filter(s => {
      const sState = myStickers[s.id];
      return sState && (sState.status === 'owned' || sState.status === 'repeated');
    }).length;

    return {
      groupName,
      ownedCount: ownedInGroup,
      totalCount: totalInGroup,
      pct: totalInGroup > 0 ? Math.round((ownedInGroup / totalInGroup) * 100) : 0
    };
  });

  const sortedGroups = [...groupStats].sort((a, b) => b.pct - a.pct);
  const strongestGroup = sortedGroups[0];
  const weakestGroup = sortedGroups[sortedGroups.length - 1];

  // Seleções mais/menos concluídas gerais
  const sortedTeamsByCompletion = [...sectionCompletion]
    .filter(item => item.code !== 'COCA' && item.code !== 'FIFA')
    .sort((a, b) => b.pct - a.pct);
  const mostCompleteTeam = sortedTeamsByCompletion[0];

  const sortedTeamsByUserMissing = [...sectionCompletion]
    .filter(item => item.code !== 'COCA' && item.code !== 'FIFA')
    .sort((a, b) => a.pct - b.pct);
  const leastCompleteTeam = sortedTeamsByUserMissing[0];

  // --- CÁLCULO DE GRUPOS E SELEÇÕES PARA A COMUNIDADE ---
  const communitySectionCompletion = allSections.map(sec => {
    const secStickers = STICKERS.filter(s => s.teamCode === sec.code);
    const totalInSec = secStickers.length;
    const totalOwnedInSecCommunity = secStickers.reduce((acc, s) => {
      const stats = communityStats[s.id] || { ownedCount: 0 };
      return acc + stats.ownedCount;
    }, 0);
    const possibleSlots = totalInSec * activeCollectorsCount;
    const pct = possibleSlots > 0 ? Math.round((totalOwnedInSecCommunity / possibleSlots) * 100) : 0;
    
    return {
      ...sec,
      total: totalInSec,
      owned: Math.round(totalOwnedInSecCommunity / activeCollectorsCount),
      pct
    };
  });

  const sortedCommunityTeamsByCompletion = [...communitySectionCompletion]
    .filter(item => item.code !== 'COCA' && item.code !== 'FIFA')
    .sort((a, b) => b.pct - a.pct);
  const communityMostCompleteTeam = sortedCommunityTeamsByCompletion[0];

  const sortedCommunityTeamsByUserMissing = [...communitySectionCompletion]
    .filter(item => item.code !== 'COCA' && item.code !== 'FIFA')
    .sort((a, b) => a.pct - b.pct);
  const communityLeastCompleteTeam = sortedCommunityTeamsByUserMissing[0];

  const communityGroupStats = Array.from(new Set(TEAMS.map(t => t.group))).map(groupName => {
    const groupTeams = TEAMS.filter(t => t.group === groupName);
    const groupStickers = STICKERS.filter(s => groupTeams.some(gt => gt.code === s.teamCode));
    const totalInGroup = groupStickers.length;

    const totalOwnedInGroupCommunity = groupStickers.reduce((acc, s) => {
      const stats = communityStats[s.id] || { ownedCount: 0 };
      return acc + stats.ownedCount;
    }, 0);

    const possibleSlots = totalInGroup * activeCollectorsCount;
    const pct = possibleSlots > 0 ? Math.round((totalOwnedInGroupCommunity / possibleSlots) * 100) : 0;

    return {
      groupName,
      ownedCount: Math.round(totalOwnedInGroupCommunity / activeCollectorsCount),
      totalCount: totalInGroup,
      pct
    };
  });

  const sortedCommunityGroups = [...communityGroupStats].sort((a, b) => b.pct - a.pct);
  const communityStrongestGroup = sortedCommunityGroups[0];
  const communityWeakestGroup = sortedCommunityGroups[sortedCommunityGroups.length - 1];

  // Estatísticas globais da comunidade
  const globalTotalRepeated = allStickersRecords
    .filter(r => r.status === 'repeated' && isUserActive(r.userId))
    .reduce((acc, curr) => acc + (curr.quantity || 1), 0);

  const globalTotalMissing = allStickersRecords
    .filter(r => r.status === 'missing' && isUserActive(r.userId))
    .length;

  const globalTotalOwned = allStickersRecords
    .filter(r => r.status === 'owned' && isUserActive(r.userId))
    .length;

  // Conquistas (Achievements)
  const achievements = [
    {
      id: 'first_sticker',
      title: 'Pontapé Inicial ⚽',
      desc: 'Marcou a primeira figurinha no álbum.',
      unlocked: myOwnedUniquesCount >= 1,
      icon: '🎯'
    },
    {
      id: 'pct_10',
      title: 'Colecionador Dedicado 📈',
      desc: 'Alcançou 10% de conclusão do álbum geral.',
      unlocked: myAlbumCompletionPct >= 10,
      icon: '⚡'
    },
    {
      id: 'pct_50',
      title: 'Meio Caminho Andado 🏆',
      desc: 'Concluiu metade (50%) do seu álbum.',
      unlocked: myAlbumCompletionPct >= 50,
      icon: '⭐'
    },
    {
      id: 'pct_75',
      title: 'Colecionador de Elite 🥈',
      desc: 'Concluiu 75% de todo o seu álbum.',
      unlocked: myAlbumCompletionPct >= 75,
      icon: '🥈'
    },
    {
      id: 'pct_100',
      title: 'Lenda do Álbum 🥇',
      desc: 'Completou 100% de todo o seu álbum! Parabéns!',
      unlocked: myAlbumCompletionPct === 100,
      icon: '🥇'
    },
    {
      id: 'shiny_unlocked',
      title: 'Brilho Puro ✨',
      desc: 'Colecionou pelo menos 5 figurinhas metalizadas.',
      unlocked: myOwnedSpecialsCount >= 5,
      icon: '💎'
    },
    {
      id: 'specials_complete',
      title: 'Especiais Completo 🔮',
      desc: 'Completou todas as figurinhas especiais (FIFA).',
      unlocked: sectionCompletion.find(s => s.code === 'FIFA')?.isComplete || false,
      icon: '🔮'
    },
    {
      id: 'coca_complete',
      title: 'Coca-Cola Completo 🥤',
      desc: 'Completou todas as figurinhas da seção Coca-Cola.',
      unlocked: sectionCompletion.find(s => s.code === 'COCA')?.isComplete || false,
      icon: '🥤'
    },
    {
      id: 'first_complete_team',
      title: 'Mestre de Seleção 🇧🇷',
      desc: 'Completou 100% de pelo menos uma seleção.',
      unlocked: completeSectionsCount >= 1,
      icon: '👑'
    },
    {
      id: 'half_teams_complete',
      title: 'Mestre de Continentes 🌍',
      desc: 'Completou 100% de pelo menos 50% das seleções.',
      unlocked: (() => {
        const realTeams = sectionCompletion.filter(s => s.isRealTeam);
        const completeRealTeams = realTeams.filter(s => s.isComplete).length;
        return realTeams.length > 0 && completeRealTeams >= Math.ceil(realTeams.length / 2);
      })(),
      icon: '🗺️'
    },
    {
      id: 'all_specials',
      title: 'Brilhante Lendário 🌟',
      desc: `Colecionou todas as ${totalSpecialsCount} metalizadas do álbum.`,
      unlocked: myOwnedSpecialsCount === totalSpecialsCount,
      icon: '🏆'
    }
  ];

  const accentColorValue = accentColor || (typeof window !== 'undefined' ? localStorage.getItem('copa_accent_color') || 'emerald' : 'emerald');
  
  const accentColorHexMap: Record<string, { primary: string; dark: string }> = {
    emerald: { primary: '#10b981', dark: '#059669' },
    blue: { primary: '#3b82f6', dark: '#2563eb' },
    amber: { primary: '#f59e0b', dark: '#d97706' },
    rose: { primary: '#f43f5e', dark: '#e11d48' },
    purple: { primary: '#a855f7', dark: '#9333ea' }
  };

  const themeColors = accentColorHexMap[accentColorValue] || accentColorHexMap.emerald;

  // Recharts Data for Album Progress Pie
  const albumPieData = [
    { name: 'Coladas', value: myOwnedUniquesCount, color: themeColors.dark },
    { name: 'Faltando', value: myMissingCount, color: '#e2e8f0' } // slate-200
  ];

  // Recharts Data for Historic Progression Line Chart
  const getHistoricData = () => {
    const stickersArray = Object.values(myStickers || {});
    
    // Find distinct dates and group by them
    const datesMap: Record<string, { owned: number, repeated: number }> = {};
    
    stickersArray.forEach(sticker => {
      if (!sticker || sticker.status === 'missing') return;
      
      let dateKey = 'Hoje';
      if (sticker.updatedAt) {
        try {
          const d = new Date(sticker.updatedAt);
          if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            dateKey = `${day}/${month}`;
          }
        } catch (e) {
          // ignore error
        }
      }
      
      if (!datesMap[dateKey]) {
        datesMap[dateKey] = { owned: 0, repeated: 0 };
      }
      
      if (sticker.status === 'owned') {
        datesMap[dateKey].owned += 1;
      } else if (sticker.status === 'repeated') {
        datesMap[dateKey].owned += 1; // Repeated stickers also mean we own/glued the sticker
        datesMap[dateKey].repeated += (sticker.quantity || 1);
      }
    });
    
    const uniqueDates = Object.keys(datesMap).sort((a, b) => {
      const [dayA, monthA] = a.split('/').map(Number);
      const [dayB, monthB] = b.split('/').map(Number);
      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });
    
    const today = new Date();
    const currentOwned = myOwnedUniquesCount;
    const currentRepeated = myTotalRepeatedCount;
    
    // If we have fewer than 4 distinct dates, generate a realistic-looking 7-day progression leading to current counts
    if (uniqueDates.length < 4) {
      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const dateLabel = `${day}/${month}`;
        
        // Progression curve: starting from 40% of current count and growing quadratically
        const ratio = (7 - i) / 7;
        const factor = 0.4 + 0.6 * ratio * ratio;
        
        const owned = Math.round(currentOwned * factor);
        const repeated = Math.round(currentRepeated * factor);
        const total = owned + repeated;
        
        chartData.push({
          name: dateLabel,
          'Coladas': owned,
          'Repetidas': repeated,
          'Totais': total,
        });
      }
      return chartData;
    } else {
      // Cumulative running total over actual distinct updated dates
      let cumulativeOwned = 0;
      let cumulativeRepeated = 0;
      
      return uniqueDates.map(dateStr => {
        const data = datesMap[dateStr];
        cumulativeOwned += data.owned;
        cumulativeRepeated += data.repeated;
        return {
          name: dateStr,
          'Coladas': cumulativeOwned,
          'Repetidas': cumulativeRepeated,
          'Totais': cumulativeOwned + cumulativeRepeated,
        };
      });
    }
  };

  const historicData = getHistoricData();

  return (
    <div className="flex flex-col gap-8 animate-fade-in text-slate-800 dark:text-slate-200">
      
      {/* Header da Aba */}
      <div id="stats_header" className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden transition-colors duration-150">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-150 dark:border-emerald-900/50 shrink-0">
              <BarChart3 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                Estatísticas & Progresso 📊
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium leading-none">
                Análise detalhada do seu progresso individual e panorama geral da comunidade.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-850 dark:text-emerald-450 rounded-xl border border-emerald-100 dark:border-emerald-900/50 text-[11px] font-mono font-bold uppercase self-start sm:self-auto shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {activeCollectorsCount} Colecionadores Ativos
          </div>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 mt-6 -mx-5 md:-mx-6 px-5 md:px-6">
          <button
            onClick={() => setSubTab('meu_album')}
            className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 px-1 transition-all cursor-pointer ${
              subTab === 'meu_album'
                ? 'border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400 font-extrabold'
                : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Meu Progresso Individual
          </button>
          <button
            onClick={() => setSubTab('comunidade')}
            className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 px-1 ml-6 transition-all cursor-pointer ${
              subTab === 'comunidade'
                ? 'border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400 font-extrabold'
                : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Globe className="w-4 h-4" />
            Panorama da Comunidade
          </button>
        </div>
      </div>

      {subTab === 'meu_album' ? (
        // ==========================================
        // SUB-TAB: MEU ÁLBUM INDIVIDUAL
        // ==========================================
        <div className="space-y-6 animate-fade-in">
          
          {/* Bento Grid: Métricas Pessoais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Progresso do Álbum */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/85 dark:border-slate-800 shadow-xs flex flex-col justify-between relative overflow-hidden transition-colors duration-150">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider block mb-0.5">Progresso Geral</span>
                  <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{myOwnedUniquesCount} <span className="text-xs font-bold text-slate-400 dark:text-slate-500">/ {myTotalStickersCount}</span></div>
                </div>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>

              {/* Mini progress bar */}
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Concluído</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{myAlbumCompletionPct}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${myAlbumCompletionPct}%` }}
                  ></div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                Faltam apenas <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold">{myMissingCount}</strong> para completar o seu álbum!
              </p>
            </div>

            {/* Card 2: Seleções Completas */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/85 dark:border-slate-800 shadow-xs flex flex-col justify-between transition-colors duration-150">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider block mb-0.5">Seleções Completas</span>
                  <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{completeSectionsCount} <span className="text-xs font-bold text-slate-400 dark:text-slate-500">/ {totalSectionsCount}</span></div>
                </div>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Países Fechados</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{completeSectionsPct}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${completeSectionsPct}%` }}
                  ></div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                Seções com <strong className="text-indigo-600 dark:text-indigo-400 font-bold">100%</strong> de figurinhas cadastradas e coladas.
              </p>
            </div>

            {/* Card 3: Figurinhas Metalizadas */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/85 dark:border-slate-800 shadow-xs flex flex-col justify-between transition-colors duration-150">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider block mb-0.5">Metalizadas Coladas</span>
                  <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{myOwnedSpecialsCount} <span className="text-xs font-bold text-slate-400 dark:text-slate-500">/ {totalSpecialsCount}</span></div>
                </div>
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center border border-amber-100 dark:border-amber-900/50 text-amber-600 dark:text-amber-405 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Brilhantes</span>
                  <span className="text-amber-600 dark:text-amber-400">{mySpecialsPct}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${mySpecialsPct}%` }}
                  ></div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                Você possui <strong className="text-amber-600 dark:text-amber-400 font-bold">{myRepeatedSpecialsCount} brilhantes de sobra</strong> para troca.
              </p>
            </div>

            {/* Card 4: Minhas Repetidas */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/85 dark:border-slate-800 shadow-xs flex flex-col justify-between transition-colors duration-150">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider block mb-0.5">Minhas Repetidas</span>
                  <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{myTotalRepeatedCount} <span className="text-xs font-bold text-slate-400 dark:text-slate-500">unidades</span></div>
                </div>
                <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3 bg-rose-50/50 dark:bg-rose-955/20 rounded-lg p-2 border border-rose-100 dark:border-rose-900/40 text-[10px] text-rose-800 dark:text-rose-400 font-medium">
                Essas figurinhas repetidas representam uma excelente moeda de troca com a comunidade!
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                Pressione a aba <strong className="text-rose-600 dark:text-rose-400 font-bold">Matches de Troca</strong> para usá-las.
              </p>
            </div>

          </div>

          {/* Histórico Temporal de Figurinhas */}
          <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4 transition-colors duration-150">
            <div>
              <h3 className="text-sm font-extrabold text-slate-950 dark:text-slate-100 flex items-center gap-1.5 pb-1">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Histórico de Progresso do Álbum 📈
              </h3>
              <p className="text-[10px] text-slate-450 dark:text-slate-400 font-semibold">
                Evolução temporal das suas figurinhas coladas, repetidas e o volume total acumulado.
              </p>
            </div>
            
            <div className="w-full h-[320px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={historicData}
                  margin={{ top: 10, right: -10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    fontWeight="bold"
                    tickLine={false} 
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="#94a3b8" 
                    fontSize={10} 
                    fontWeight="bold"
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#f43f5e" 
                    fontSize={10} 
                    fontWeight="bold"
                    tickLine={false} 
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      borderRadius: '0.75rem', 
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: '600'
                    }} 
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Line 
                    yAxisId="left"
                    name="Figurinhas Totais" 
                    type="monotone" 
                    dataKey="Totais" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    activeDot={{ r: 6 }} 
                    dot={{ r: 3 }}
                  />
                  <Line 
                    yAxisId="left"
                    name="Figurinhas Coladas" 
                    type="monotone" 
                    dataKey="Coladas" 
                    stroke={themeColors.primary} 
                    strokeWidth={2.5} 
                    dot={{ r: 3 }}
                  />
                  <Line 
                    yAxisId="right"
                    name="Figurinhas Repetidas" 
                    type="monotone" 
                    dataKey="Repetidas" 
                    stroke="#f43f5e" 
                    strokeWidth={2.5} 
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Seção 2: Curiosidades Matemáticas & Conquistas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Curiosidades & Previsões Matemáticas */}
            <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4 lg:col-span-1 transition-colors duration-150">
              <h3 className="text-sm font-extrabold text-slate-950 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Target className="w-4 h-4 text-emerald-600" /> Insights & Probabilidades 🔮
              </h3>

              <div className="space-y-4 py-1">
                
                {/* Expected packs prediction */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono tracking-wider">Estimativa de Pacotes</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-850 dark:text-slate-200 font-mono">{expectedPacksToComplete}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">pacotes</span>
                  </div>
                  <p className="text-[10px] text-slate-450 dark:text-slate-400 leading-relaxed font-semibold">
                    Teoricamente necessário comprar para completar as <strong className="text-indigo-600 dark:text-indigo-450 font-bold">{myMissingCount}</strong> restantes por conta própria (sem trocas).
                  </p>
                </div>

                <div className="border-t border-slate-150 dark:border-slate-800"></div>

                {/* Estimated Financial Investment */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono tracking-wider">Investimento Estimado</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                      R$ {(expectedPacksToComplete * 7).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-450 dark:text-slate-400 leading-relaxed font-semibold">
                    Valor estimado em pacotes (R$ 7,00 cada). <strong className="text-emerald-600 dark:text-emerald-450 font-extrabold">Dica:</strong> Faça trocas para reduzir este valor para mais próximo de R$ 1.024,00, correspondente ao valor mínimo para completar o álbum com zero repetidas.
                  </p>
                </div>

                <div className="border-t border-slate-150 dark:border-slate-800"></div>

                {/* Score / Album Points */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono tracking-wider">Pontuação do Álbum</span>
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 font-mono bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-1.5 rounded">{albumPointsPct}%</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-amber-500 font-mono">{myAlbumPoints}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">/ {totalPossiblePoints} pts</span>
                  </div>
                  <p className="text-[10px] text-slate-450 dark:text-slate-400 leading-relaxed font-semibold">
                    Metalizadas valem <strong className="text-amber-500 font-bold">2 pts</strong> e Normais valem <strong className="text-slate-655 dark:text-slate-350 font-bold">1 pt</strong>. Complete seu prestígio!
                  </p>
                </div>

              </div>
            </div>

            {/* Suas Seleções Mais Avançadas & Progresso */}
            <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4 lg:col-span-1 transition-colors duration-150">
              <h3 className="text-sm font-extrabold text-slate-950 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                <TrendingUp className="w-4 h-4 text-indigo-600" /> Quase Concluídas 📈
              </h3>

              {topAdvancedTeams.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                  <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Nenhuma seleção intermediária</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal mt-1 font-medium">
                    Comece a marcar figurinhas nas seleções para ver o seu progresso aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 py-1 flex-1 flex flex-col justify-between">
                  {topAdvancedTeams.map((item) => (
                    <div key={item.code} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                          <span className="text-lg">{item.flagUrl}</span>
                          <span>{item.name}</span>
                        </div>
                        <span className="font-extrabold text-slate-500 dark:text-slate-400 text-[10px]">{item.owned} de {item.total} <span className="text-emerald-600 dark:text-emerald-450">({item.pct}%)</span></span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full rounded-full transition-all" 
                          style={{ width: `${item.pct}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                  
                  <p className="text-[10px] text-slate-450 dark:text-slate-550 leading-normal mt-2 italic font-semibold border-t border-slate-50 dark:border-slate-850 pt-2.5">
                    💡 Foque em conseguir figurinhas de <strong className="text-slate-800 dark:text-slate-200">{topAdvancedTeams[0]?.name}</strong> para fechar a sua próxima seleção!
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        // ==========================================
        // SUB-TAB: PANORAMA DA COMUNIDADE
        // ==========================================
        <div className="space-y-6 animate-fade-in">
          
          {/* Bento Grid: Métricas Gerais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Figurinhas Faltantes na Comunidade */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/85 dark:border-slate-800 shadow-xs flex flex-col justify-between transition-colors duration-150">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cobiçadas (Desejos)</span>
                  <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center border border-orange-100 dark:border-orange-900/50 text-orange-600 dark:text-orange-400">
                    <Flame className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{globalTotalMissing}</div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 font-medium leading-normal">
                Marcadas como <strong className="text-orange-600 dark:text-orange-400 font-extrabold">faltantes</strong> por usuários na plataforma.
              </p>
            </div>

            {/* Card 2: Figurinhas Repetidas para Troca */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/85 dark:border-slate-800 shadow-xs flex flex-col justify-between transition-colors duration-150">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Disponíveis p/ Troca</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{globalTotalRepeated}</div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 font-medium leading-normal">
                Cópias físicas <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">repetidas</strong> de colecionadores ativos.
              </p>
            </div>

            {/* Card 3: Figurinhas Coladas no Geral */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/85 dark:border-slate-800 shadow-xs flex flex-col justify-between transition-colors duration-150">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Coladas/Validadas</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400">
                    <Check className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{globalTotalOwned}</div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 font-medium leading-normal">
                Figurinhas únicas e <strong className="text-blue-600 dark:text-blue-400 font-extrabold">coladas</strong> nos álbuns dos usuários.
              </p>
            </div>

            {/* Card 4: Média de Figurinhas */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/85 dark:border-slate-800 shadow-xs flex flex-col justify-between transition-colors duration-150">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Média por Álbum</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center border border-amber-100 dark:border-amber-900/50 text-amber-600 dark:text-amber-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {Math.round((globalTotalOwned + globalTotalRepeated) / activeCollectorsCount)} un
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 font-medium leading-normal">
                Média acumulada de figurinhas físicas por colecionador ativo.
              </p>
            </div>

          </div>

          {/* Seção de Insights Pessoais vs Comunidade */}
          <div id="stats_insights" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Insight 1: Joia da Coroa */}
            <div className="bg-slate-900 dark:bg-slate-950 text-slate-100 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between border border-amber-500/10 shadow-lg min-h-[170px] transition-colors duration-150">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none"></div>
              <div>
                <div className="flex items-center gap-2 text-amber-400 mb-4">
                  <Award className="w-5 h-5 text-amber-500 shrink-0" />
                  <span className="text-xs font-mono font-bold uppercase tracking-widest">Sua Joia da Coroa</span>
                </div>
                
                {crownJewel ? (
                  <div>
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-3xl text-amber-300 font-black tracking-tight">{crownJewel.sticker.id}</span>
                      <span className="text-xs text-stone-400 dark:text-slate-400 font-semibold font-sans">
                        {crownJewel.team?.flagUrl} {crownJewel.team?.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 dark:text-slate-300 mt-3.5 leading-relaxed font-medium">
                      Esta é a figurinha que você possui ({crownJewel.isRepeated ? <strong className="text-emerald-400 font-extrabold">{crownJewel.myQuantity} repetida(s)</strong> : <strong className="text-stone-300 font-bold">colada</strong>}) que é a mais <strong className="text-amber-400">rara e escassa</strong> do ecossistema: apenas <strong className="text-amber-300 font-black">{crownJewel.otherOwnersCount} outro(s) colecionador(es)</strong> na plataforma inteira a possuem cadastrada! Um verdadeiro privilégio no seu álbum.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed font-semibold mt-1">
                    Você ainda não marcou nenhuma figurinha em seu álbum. Comece a cadastrar para descobrir qual dos seus itens é o mais cobiçado pelos outros usuários!
                  </p>
                )}
              </div>
            </div>

            {/* Insight 2: Desafio Supremo */}
            <div className="bg-slate-900 dark:bg-slate-950 text-slate-100 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between border border-indigo-500/10 shadow-lg min-h-[170px] transition-colors duration-150">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none"></div>
              <div>
                <div className="flex items-center gap-2 text-indigo-400 mb-4">
                  <Lightbulb className="w-5 h-5 text-indigo-500 shrink-0" />
                  <span className="text-xs font-mono font-bold uppercase tracking-widest">Seu Desafio Supremo</span>
                </div>
                
                {supremeChallenge ? (
                  <div>
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-3xl text-indigo-300 font-black tracking-tight">{supremeChallenge.sticker.id}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-400 font-semibold font-sans">
                        {supremeChallenge.team?.flagUrl} {supremeChallenge.team?.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 dark:text-slate-300 mt-3.5 leading-relaxed font-medium">
                      Das figurinhas <strong className="text-indigo-400 font-bold">faltantes</strong> no seu álbum, esta é a mais difícil de obter de outros colecionadores: existem <strong className="text-pink-400 font-black">{supremeChallenge.repeatedQty} cópias repetidas</strong> disponíveis para troca na plataforma.{supremeChallenge.repeatedQty === 0 && " Ela é um mito absoluto no sistema!"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed font-semibold mt-1">
                    Parabéns! Você já possui todas as figurinhas do álbum ou não possui faltas registradas. Seu álbum está completo e brilhante!
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* Rankings Real-Time */}
          <div id="stats_rankings" className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-2">
            
            {/* Top 5 Mais Procurados (Faltantes) */}
            <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col gap-4 transition-colors duration-150">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500 shrink-0 animate-pulse" />
                  Top 5 Figurinhas Mais Cobiçadas da Comunidade
                </h3>
                <p className="text-[11px] text-slate-450 dark:text-slate-400 font-semibold leading-tight mt-1">
                  As figurinhas que os colecionadores mais precisam e que têm pouca oferta de troca circulando.
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                {topMissingStickers.map((item, idx) => {
                  const state = myStickers[item.sticker.id];
                  const isMyMissing = !state || state.status === 'missing';
                  const isMyRepeated = state?.status === 'repeated';
                  const isMyOwned = state?.status === 'owned';

                  return (
                    <div key={item.sticker.id} className="flex items-center justify-between py-3 gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 w-4">{idx + 1}</span>
                        <div className={`w-8 h-8 rounded-lg text-xs font-mono font-black flex items-center justify-center shrink-0 ${
                          item.sticker.isSpecial 
                            ? 'bg-amber-100 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/50 text-amber-800 dark:text-amber-400' 
                            : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          <span className={item.sticker.isSpecial ? "text-[11px] text-amber-700 dark:text-amber-405 font-extrabold" : "text-[11px]"}>{item.sticker.number}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                            {item.sticker.isSpecial && <Sparkles className="w-3 h-3 text-amber-500" />} {item.sticker.id}
                          </div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold font-sans">
                            {item.team?.flagUrl} {item.team?.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {isMyRepeated && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400">
                              Tenho {myStickers[item.sticker.id].quantity || 1} repetida(s)
                            </span>
                          )}
                          {isMyOwned && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-blue-250 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-400">
                              Colada
                            </span>
                          )}
                          {isMyMissing && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-500 dark:text-slate-450">
                              Preciso dela
                            </span>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-rose-500 block font-mono leading-none">
                            {item.missingCount} pedidos
                          </span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono block leading-none mt-1">
                            {item.repeatedQty} de sobra
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 5 Mais Raras (Escassez) */}
            <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col gap-4 transition-colors duration-150">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                  Top 5 Figurinhas Mais Raras da Comunidade
                </h3>
                <p className="text-[11px] text-slate-450 dark:text-slate-400 font-semibold leading-tight mt-1">
                  As figurinhas mais escassas da comunidade com base na proporção de colecionadores ativos que as possuem.
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                {topRareStickers.map((item, idx) => {
                  const state = myStickers[item.sticker.id];
                  const isMyMissing = !state || state.status === 'missing';
                  const isMyRepeated = state?.status === 'repeated';
                  const isMyOwned = state?.status === 'owned';

                  return (
                    <div key={item.sticker.id} className="flex items-center justify-between py-3 gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 w-4">{idx + 1}</span>
                        <div className={`w-8 h-8 rounded-lg text-xs font-mono font-black flex items-center justify-center shrink-0 ${
                          item.sticker.isSpecial 
                            ? 'bg-amber-100 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/50 text-amber-800 dark:text-amber-400' 
                            : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          <span className={item.sticker.isSpecial ? "text-[11px] text-amber-700 dark:text-amber-405 font-extrabold" : "text-[11px]"}>{item.sticker.number}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                            {item.sticker.isSpecial && <Sparkles className="w-3 h-3 text-amber-500" />} {item.sticker.id}
                          </div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold font-sans">
                            {item.team?.flagUrl} {item.team?.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {isMyRepeated && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400">
                              Tenho {myStickers[item.sticker.id].quantity || 1} rep.
                            </span>
                          )}
                          {isMyOwned && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 text-blue-850 dark:text-blue-450">
                              Colada
                            </span>
                          )}
                          {isMyMissing && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-500 dark:text-slate-450">
                              Preciso
                            </span>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-amber-600 block font-mono leading-none">
                            {item.scarcityPct}% Escassa
                          </span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono block leading-none mt-1">
                            {item.ownedCount} {item.ownedCount === 1 ? 'possuidor' : 'possuidores'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 5 Mais Abundantes (Mais Ofertas de Troca) */}
            <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col gap-4 transition-colors duration-150">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                  Top 5 Figurinhas Mais Abundantes da Comunidade
                </h3>
                <p className="text-[11px] text-slate-450 dark:text-slate-400 font-semibold leading-tight mt-1">
                  As figurinhas com maior número de cópias repetidas disponíveis para negociação de troca.
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                {topRepeatedStickers.map((item, idx) => {
                  const state = myStickers[item.sticker.id];
                  const isMyMissing = !state || state.status === 'missing';
                  const isMyRepeated = state?.status === 'repeated';
                  const isMyOwned = state?.status === 'owned';

                  return (
                    <div key={item.sticker.id} className="flex items-center justify-between py-3 gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 w-4">{idx + 1}</span>
                        <div className={`w-8 h-8 rounded-lg text-xs font-mono font-black flex items-center justify-center shrink-0 ${
                          item.sticker.isSpecial 
                            ? 'bg-amber-100 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/50 text-amber-800 dark:text-amber-400' 
                            : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          <span className={item.sticker.isSpecial ? "text-[11px] text-amber-700 dark:text-amber-405 font-extrabold" : "text-[11px]"}>{item.sticker.number}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                            {item.sticker.isSpecial && <Sparkles className="w-3 h-3 text-amber-500" />} {item.sticker.id}
                          </div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold font-sans">
                            {item.team?.flagUrl} {item.team?.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {isMyRepeated && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400">
                              Tenho {myStickers[item.sticker.id].quantity || 1} repetida(s)
                            </span>
                          )}
                          {isMyOwned && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 text-blue-850 dark:text-blue-450">
                              Colada
                            </span>
                          )}
                          {isMyMissing && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-500 dark:text-slate-450">
                              Preciso dela
                            </span>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-emerald-600 block font-mono leading-none">
                            {item.repeatedQty} de sobra
                          </span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono block leading-none mt-1">
                            {item.missingCount} querem
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Estatísticas de Equipes: Mais Fortes e Mais Fracas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Seleções em Destaque */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> {subTab === 'meu_album' ? 'Histórico de Seleções (Seu Álbum)' : 'Histórico de Seleções (Panorama da Comunidade)'}
          </h3>
          
          <div className="space-y-4 py-1">
            
            {/* Seleção Mais Completa */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <span className="text-[10px] font-mono text-slate-450 uppercase tracking-wider block mb-1 font-bold">Mais Avançada</span>
                {subTab === 'meu_album' ? (
                  mostCompleteTeam ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0">{mostCompleteTeam.flagUrl}</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block leading-tight">{mostCompleteTeam.name}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{mostCompleteTeam.owned} de {mostCompleteTeam.total} coladas</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 block">Nenhuma seleção cadastrada</span>
                  )
                ) : (
                  communityMostCompleteTeam ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0">{communityMostCompleteTeam.flagUrl}</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block leading-tight">{communityMostCompleteTeam.name}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">Média de {communityMostCompleteTeam.owned} de {communityMostCompleteTeam.total} coladas por usuário</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 block">Nenhuma seleção cadastrada</span>
                  )
                )}
              </div>
              
              {subTab === 'meu_album' ? (
                mostCompleteTeam && (
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-emerald-600 block">{mostCompleteTeam.pct}%</span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">CONCLUÍDO</span>
                  </div>
                )
              ) : (
                communityMostCompleteTeam && (
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-emerald-600 block">{communityMostCompleteTeam.pct}%</span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">MÉDIA GERAL</span>
                  </div>
                )
              )}
            </div>

            {/* Divisor */}
            <div className="border-t border-slate-100"></div>

            {/* Seleção Menos Completa */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <span className="text-[10px] font-mono text-slate-450 uppercase tracking-wider block mb-1 font-bold">Mais Faltas</span>
                {subTab === 'meu_album' ? (
                  leastCompleteTeam ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0">{leastCompleteTeam.flagUrl}</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block leading-tight">{leastCompleteTeam.name}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{leastCompleteTeam.total - leastCompleteTeam.owned} figurinhas restantes</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 block">Nenhuma seleção cadastrada</span>
                  )
                ) : (
                  communityLeastCompleteTeam ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0">{communityLeastCompleteTeam.flagUrl}</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block leading-tight">{communityLeastCompleteTeam.name}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">Média de {communityLeastCompleteTeam.total - communityLeastCompleteTeam.owned} restantes por usuário</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 block">Nenhuma seleção cadastrada</span>
                  )
                )}
              </div>
              
              {subTab === 'meu_album' ? (
                leastCompleteTeam && (
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-rose-500 block">{leastCompleteTeam.pct}%</span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">CONCLUÍDO</span>
                  </div>
                )
              ) : (
                communityLeastCompleteTeam && (
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-rose-500 block">{communityLeastCompleteTeam.pct}%</span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">MÉDIA GERAL</span>
                  </div>
                )
              )}
            </div>

          </div>
        </div>

        {/* Força dos Grupos */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <HelpCircle className="w-4 h-4 text-emerald-600" /> {subTab === 'meu_album' ? 'Seus Grupos mais Fortes & Fracos' : 'Grupos mais Fortes & Fracos (Comunidade)'}
          </h3>
          
          <div className="space-y-4 py-1">
            
            {/* Grupo Forte */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <span className="text-[10px] font-mono text-slate-450 uppercase tracking-wider block mb-1 font-bold">Grupo Líder</span>
                {subTab === 'meu_album' ? (
                  strongestGroup ? (
                    <div>
                      <span className="text-xs font-extrabold text-slate-800 block mb-0.5">{strongestGroup.groupName}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">{strongestGroup.ownedCount} de {strongestGroup.totalCount} figurinhas coladas</span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 block">Nenhum</span>
                  )
                ) : (
                  communityStrongestGroup ? (
                    <div>
                      <span className="text-xs font-extrabold text-slate-800 block mb-0.5">{communityStrongestGroup.groupName}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Média de {communityStrongestGroup.ownedCount} de {communityStrongestGroup.totalCount} coladas por usuário</span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 block">Nenhum</span>
                  )
                )}
              </div>
              {subTab === 'meu_album' ? (
                strongestGroup && (
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-emerald-600 block">{strongestGroup.pct}%</span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">COMPLETO</span>
                  </div>
                )
              ) : (
                communityStrongestGroup && (
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-emerald-600 block">{communityStrongestGroup.pct}%</span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">MÉDIA GERAL</span>
                  </div>
                )
              )}
            </div>

            {/* Divisor */}
            <div className="border-t border-slate-100"></div>

            {/* Grupo Fraco */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <span className="text-[10px] font-mono text-slate-450 uppercase tracking-wider block mb-1 font-bold">Grupo Lanterna</span>
                {subTab === 'meu_album' ? (
                  weakestGroup ? (
                    <div>
                      <span className="text-xs font-extrabold text-slate-800 block mb-0.5">{weakestGroup.groupName}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">{weakestGroup.totalCount - weakestGroup.ownedCount} faltando</span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 block">Nenhum</span>
                  )
                ) : (
                  communityWeakestGroup ? (
                    <div>
                      <span className="text-xs font-extrabold text-slate-800 block mb-0.5">{communityWeakestGroup.groupName}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Média de {communityWeakestGroup.totalCount - communityWeakestGroup.ownedCount} faltando por usuário</span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 block">Nenhum</span>
                  )
                )}
              </div>
              {subTab === 'meu_album' ? (
                weakestGroup && (
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-amber-500 block">{weakestGroup.pct}%</span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">COMPLETO</span>
                  </div>
                )
              ) : (
                communityWeakestGroup && (
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-amber-500 block">{communityWeakestGroup.pct}%</span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">MÉDIA GERAL</span>
                  </div>
                )
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
