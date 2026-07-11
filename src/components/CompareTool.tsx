import React, { useState } from 'react';
import { 
  Clipboard, Check, Share2, ArrowRightLeft, FileText, 
  Sparkles, CheckCircle, HelpCircle, ExternalLink, RefreshCw, X
} from 'lucide-react';
import { STICKERS, TEAMS } from '../data';
import { UserSticker, Sticker } from '../types';

interface CompareToolProps {
  myStickers: Record<string, UserSticker>;
}

export default function CompareTool({ myStickers }: CompareToolProps) {
  const [mode, setMode] = useState<'direct' | 'reverse'>('direct');
  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Parse stickers from arbitrary text
  const parseStickersFromText = (text: string): Sticker[] => {
    if (!text) return [];
    const foundStickers: Sticker[] = [];
    const foundIds = new Set<string>();

    // 1. Check for special '00'
    const s00Regex = /\b00\b/;
    if (s00Regex.test(text)) {
      const s00 = STICKERS.find(s => s.id === '00');
      if (s00) {
        foundStickers.push(s00);
        foundIds.add('00');
      }
    }

    // 2. Regex for standard team prefixes (3 chars) and virtual team 'CC' (Coca-Cola)
    // Allows optional dash, space, or underscores and zeroes
    const regex = /\b(FWC|CC|[A-Z]{3})[-_\s]*(0?[0-9]+)\b/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const prefix = match[1].toUpperCase();
      const num = parseInt(match[2], 10);
      const stickerId = `${prefix}${num}`;
      
      const found = STICKERS.find(s => s.id === stickerId);
      if (found && !foundIds.has(found.id)) {
        foundStickers.push(found);
        foundIds.add(found.id);
      }
    }

    return foundStickers;
  };

  const parsedAll = parseStickersFromText(inputText);

  // Helper to find team metadata
  const getTeamFlagAndName = (teamCode: string) => {
    if (teamCode === 'FIFA') return { flag: '🏆', name: 'FIFA Especiais' };
    const team = TEAMS.find(t => t.code === teamCode);
    return { 
      flag: team?.flagUrl || '🏳️', 
      name: team?.name || teamCode 
    };
  };

  // Filter matched stickers depending on active mode:
  // - direct: stickers parsed from text that I am MISSING
  // - reverse: stickers parsed from text that I have REPEATED
  const matchedStickers = parsedAll.filter(sticker => {
    const myState = myStickers[sticker.id];
    if (mode === 'direct') {
      // I miss it: not owned at all, or explicitly marked as missing
      return !myState || myState.status === 'missing';
    } else {
      // I have repeated copies of it
      return myState && myState.status === 'repeated' && (myState.quantity || 1) > 0;
    }
  }).sort((a, b) => {
    const idxA = STICKERS.findIndex(s => s.id === a.id);
    const idxB = STICKERS.findIndex(s => s.id === b.id);
    return idxA - idxB;
  });

  // Pre-fill sample text to help user understand how it works
  const handleLoadSample = () => {
    if (mode === 'direct') {
      setInputText(
        "Olá, amigos! Tenho as seguintes repetidas da Copa para trocar hoje:\n" +
        "BRASIL: BRA-1, BRA 5, BRA 12\n" +
        "FIFA: FWC 2, FWC 15, 00\n" +
        "OUTRAS: ARG 10, GER 4, SUI-5, CC 1, CC 12.\n" +
        "Me avisem se precisarem de alguma!"
      );
    } else {
      setInputText(
        "Galera, estou quase completando meu álbum! Só me faltam essas:\n" +
        "ARG 2, BRA 12, SUI 5, FWC 15, CC 1 e GER 12.\n" +
        "Quem tiver alguma delas e puder me ajudar ou vender, me chama no privado!"
      );
    }
    triggerNotification("Texto de exemplo carregado com sucesso!");
  };

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Generate shareable match text
  const getShareText = () => {
    if (matchedStickers.length === 0) return '';
    const codesStr = matchedStickers.map(s => s.id).join(', ');
    
    const appUrl = 'https://figurinhas2026-rust.vercel.app/';
    const promoSuffix = `\n\n🏆 *Gerencie seu álbum e encontre trocas no Figurinhas Copa 2026!*\n👉 Cadastre-se grátis em: ${appUrl}`;

    if (mode === 'direct') {
      return `💬 *Match de Figurinhas - Copa 2026!*\n\nOlá! Analisei as figurinhas que você tem disponíveis e vi que estas estão me faltando:\n👉 *${codesStr}*\n\nPodemos combinar de trocar? 😊${promoSuffix}`;
    } else {
      return `💬 *Match de Figurinhas - Copa 2026!*\n\nOlá! Analisei a lista de figurinhas que você está precisando e vi que tenho estas repetidas para te oferecer:\n👉 *${codesStr}*\n\nPodemos combinar de trocar? 😊${promoSuffix}`;
    }
  };

  const handleCopy = () => {
    const text = getShareText();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    triggerNotification("Mensagem copiada para a área de transferência! Pronta para colar no WhatsApp.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = getShareText();
    if (!text) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div id="compare_tool_container" className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col gap-6 transition-colors duration-150">
      
      {/* Header Banner */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-450">
              <ArrowRightLeft className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Conferência de Figurinhas Externa
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Compare rapidamente mensagens de texto ou listas de amigos com o seu progresso do álbum.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Switches */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            setMode('direct');
            setInputText('');
          }}
          className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-black transition cursor-pointer ${
            mode === 'direct'
              ? 'bg-white dark:bg-slate-800 text-emerald-955 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <span className="text-sm">📥</span>
          O que ele tem ➔ Minhas Faltantes
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('reverse');
            setInputText('');
          }}
          className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-black transition cursor-pointer ${
            mode === 'reverse'
              ? 'bg-white dark:bg-slate-800 text-emerald-955 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <span className="text-sm">📤</span>
          O que ele precisa ➔ Minhas Repetidas (Reverso)
        </button>
      </div>

      {/* Input Box Area */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-baseline">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            {mode === 'direct' 
              ? 'Cole a lista de REPETIDAS do colecionador externo:' 
              : 'Cole a lista de FALTANTES do colecionador externo:'
            }
          </label>
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">Suporta códigos livres (ex: BRA-1, ARG12, FWC 2)</span>
        </div>
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={5}
            placeholder={
              mode === 'direct'
                ? "Exemplo de colagem:\n'Oi pessoal, tenho pra troca: BRA-01, BRA05, FWC02, CC1, FWC15, 00, ARG 14, SUI-12...'"
                : "Exemplo de colagem:\n'Faltam pra mim: BRA 12, GER 3, FWC 15, SUI 5, CC1 e MEX 20...'"
            }
            className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-emerald-500 focus:outline-none text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-650 leading-relaxed font-semibold shadow-xs"
          />
          {inputText && (
            <button
              type="button"
              onClick={() => setInputText('')}
              className="absolute bottom-3 right-3 p-1.5 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-400 rounded-lg transition"
              title="Limpar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results Section */}
      <div className="flex flex-col gap-4">
        
        {/* Statistics of Extraction */}
        {inputText && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                Encontramos <strong className="text-slate-800 dark:text-slate-200 font-extrabold font-mono">{parsedAll.length}</strong> referências de figurinhas no seu texto.
              </span>
            </div>
            {parsedAll.length > 0 && (
              <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-350 px-2 py-0.5 rounded-md font-mono font-bold uppercase">
                Análise Concluída
              </span>
            )}
          </div>
        )}

        {/* Matches Header & Sharing Controls */}
        {matchedStickers.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10 border border-emerald-100 dark:border-emerald-900/40 p-4 rounded-2xl">
            <div className="flex flex-col">
              <span className="text-xs font-black text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {mode === 'direct' 
                  ? 'Você precisa destas que ele tem!' 
                  : 'Ele precisa destas que você tem repetidas!'
                }
              </span>
              <span className="text-[10px] text-emerald-700/85 dark:text-emerald-450 font-semibold">
                Encontrado <strong className="font-extrabold text-emerald-850 dark:text-emerald-350">{matchedStickers.length} match(es)</strong> perfeito(s). Compartilhe o resultado!
              </span>
            </div>
            
            {/* Share / Copy Action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold transition cursor-pointer shadow-xs active:scale-98"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Clipboard className="w-3.5 h-3.5" />}
                {copied ? 'Copiado!' : 'Copiar Mensagem'}
              </button>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black transition cursor-pointer shadow-xs active:scale-98"
              >
                <Share2 className="w-3.5 h-3.5" />
                Enviar no WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* Stickers Match Showcase */}
        {inputText ? (
          matchedStickers.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {matchedStickers.map((sticker) => {
                const teamInfo = getTeamFlagAndName(sticker.teamCode);
                const isSpecial = sticker.isSpecial;
                const userState = myStickers[sticker.id];
                const repeatedQty = userState?.status === 'repeated' ? (userState.quantity || 1) : 0;

                return (
                  <div
                    key={sticker.id}
                    className={`relative border rounded-xl p-3 flex flex-col items-center justify-between text-center transition shadow-2xs ${
                      isSpecial 
                        ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-250 dark:border-amber-900/60 hover:border-amber-400 dark:hover:border-amber-500' 
                        : 'bg-slate-50/40 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-850 hover:border-slate-350 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Tiny shiny icon */}
                    {isSpecial && (
                      <span className="absolute top-1 right-1 text-[9.5px]" title="Metalizada/Brilhante">
                        ✨
                      </span>
                    )}

                    {/* Flag & Team code header */}
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="text-xs">{teamInfo.flag}</span>
                      <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 font-mono tracking-wider">{sticker.teamCode}</span>
                    </div>

                    {/* Sticker code display */}
                    <div className="mb-1">
                      <span className={`text-sm font-black font-mono px-2 py-0.5 rounded-lg ${
                        isSpecial ? 'bg-amber-200/60 dark:bg-amber-900/40 text-amber-950 dark:text-amber-300' : 'bg-slate-200/60 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200'
                      }`}>
                        {sticker.id}
                      </span>
                    </div>

                    {/* Status badge */}
                    <div className="mt-1.5">
                      {mode === 'direct' ? (
                        <span className="text-[9px] font-black text-rose-650 dark:text-rose-450 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded-md border border-rose-100/60 dark:border-rose-900/40 font-mono uppercase tracking-wide">
                          Faltando
                        </span>
                      ) : (
                        <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-md border border-emerald-100/60 dark:border-emerald-900/40 font-mono uppercase tracking-wide">
                          Tenho ({repeatedQty}x)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2">
              <span className="text-2xl">🔍</span>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-350">
                Nenhum match encontrado para o texto fornecido.
              </p>
              <p className="text-[10px] text-slate-450 dark:text-slate-500 px-6 max-w-sm font-semibold leading-relaxed">
                {mode === 'direct' 
                  ? 'Todas as figurinhas identificadas na lista já estão marcadas como conquistadas ou repetidas no seu álbum.' 
                  : 'Nenhuma das figurinhas identificadas na lista de faltas dele corresponde a uma figurinha que você tenha repetida.'
                }
              </p>
            </div>
          )
        ) : (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">📋</span>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Aguardando a colagem do texto para análise...</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 px-6 max-w-sm leading-relaxed font-semibold">
              Cole listas informais ou mensagens recebidas em grupos para identificar as trocas possíveis na hora!
            </p>
          </div>
        )}

      </div>

      {/* Floating Alert / Notification Banner */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 dark:bg-slate-950 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 max-w-xs sm:max-w-md border border-slate-850 dark:border-slate-800 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-[11px] font-bold tracking-tight leading-snug">{notification}</p>
        </div>
      )}

    </div>
  );
}
