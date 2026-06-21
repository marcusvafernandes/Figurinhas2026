/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ChatMessage, Chat } from '../types';
import { Send, X, PhoneCall, Smile, UserCheck, MessageSquarePlus } from 'lucide-react';

interface ChatWindowProps {
  chatId: string;
  partnerId: string;
  partnerName: string;
  partnerWhatsapp?: string;
  currentUser: { uid: string; displayName: string };
  onClose: () => void;
}

export default function ChatWindow({
  chatId,
  partnerId,
  partnerName,
  partnerWhatsapp,
  currentUser,
  onClose
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const prevLengthRef = useRef(0);

  // Load chat messages in real time
  useEffect(() => {
    const messagesPath = `chats/${chatId}/messages`;
    const q = query(
      collection(db, messagesPath),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({
          id: docSnap.id,
          chatId: data.chatId,
          senderId: data.senderId,
          senderName: data.senderName,
          text: data.text,
          createdAt: data.createdAt?.toDate()?.toISOString() || new Error().toString()
        });
      });
      setMessages((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(msgs)) {
          return msgs;
        }
        return prev;
      });
    }, (error) => {
      // Graceful permission logic or handled error
      console.error("Chat Messages permission error:", error);
    });

    return () => unsubscribe();
  }, [chatId]);

  // Scroll to bottom only if new messages actually arrived (avoids mobile viewport jumping)
  useEffect(() => {
    if (messages.length !== prevLengthRef.current) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
      prevLengthRef.current = messages.length;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setError(null);
    const messageText = text.trim();
    setText('');
    setLoading(true);

    try {
      // 1. Ensure/Create Chat Room Header if it might not exist yet, or just update it
      const chatDocRef = doc(db, 'chats', chatId);
      await setDoc(chatDocRef, {
        id: chatId,
        participants: [currentUser.uid, partnerId],
        participantDetails: {
          [currentUser.uid]: {
            displayName: currentUser.displayName
          },
          [partnerId]: {
            displayName: partnerName,
            ...(partnerWhatsapp ? { whatsapp: partnerWhatsapp } : {})
          }
        },
        lastMessage: messageText,
        lastMessageAt: serverTimestamp(),
        lastSenderId: currentUser.uid
      }, { merge: true });

      // 2. Add message to subcollection
      const messagesPath = `chats/${chatId}/messages`;
      await addDoc(collection(db, messagesPath), {
        id: '', // database will generate ID
        chatId: chatId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        text: messageText,
        createdAt: serverTimestamp()
      });

    } catch (error) {
      console.error(error);
      try {
        handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}`);
      } catch (err: any) {
        setError("Não foi possível enviar a mensagem. Por favor, verifique sua conexão.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Build clean WhatsApp link
  const getWhatsAppLink = (number: string) => {
    // strip non-numeric
    const cleanNum = number.replace(/\D/g, '');
    // add Brazilian code 55 if not present and starts with 11-99 etc
    const withCountry = cleanNum.length <= 11 ? `55${cleanNum}` : cleanNum;
    return `https://wa.me/${withCountry}?text=Ol%C3%A1%20${encodeURIComponent(partnerName)}%2C%20vi%20seu%20perfil%20no%20app%20de%20figurinhas%20da%20Copa%202026%20e%20gostaria%20de%20combinar%20uma%20troca!`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3.5 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <h4 id="chat_partner_name" className="font-bold text-sm text-slate-100">{partnerName}</h4>
            <p className="text-[10px] text-slate-400 font-mono">Chat em Tempo Real</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {partnerWhatsapp && (
            <a 
              href={getWhatsAppLink(partnerWhatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-400 transition text-xs flex items-center gap-1 font-semibold"
              title="Conversar direto no WhatsApp"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          )}
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Sandbox Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900 custom-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <MessageSquarePlus className="w-10 h-10 mb-2 opacity-30 text-emerald-500" />
            <p className="text-xs font-semibold">Envie uma mensagem para começar a negociação!</p>
            <p className="text-[10px] text-slate-500 max-w-[240px] mt-1">Combine locais físicos, envios ou permutas de figurinhas repetidas por faltantes.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.uid;
            return (
              <div 
                key={msg.id || index}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div 
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                    isMe 
                      ? 'bg-emerald-600 text-white rounded-br-none' 
                      : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-750'
                  }`}
                >
                  <p className="font-semibold text-[10px] opacity-75 mb-0.5">{isMe ? 'Você' : msg.senderName}</p>
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message Input Interface */}
      {error && (
        <div className="mx-3 my-1 px-3 py-1.5 bg-red-950/40 border border-red-900 rounded-lg text-[10px] text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-400 font-bold ml-2 cursor-pointer text-xs">×</button>
        </div>
      )}
      <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
        <input 
          type="text"
          placeholder="Escreva sua proposta de troca..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
        />
        <button 
          type="submit"
          disabled={!text.trim() || loading}
          className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition cursor-pointer disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

    </div>
  );
}
