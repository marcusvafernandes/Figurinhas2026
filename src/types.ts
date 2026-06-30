/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  whatsapp?: string;
  createdAt: string;
}

export type StickerStatus = 'missing' | 'repeated' | 'owned';

export interface UserSticker {
  id: string; // userId_stickerId
  userId: string;
  userDisplayName: string;
  stickerId: string;
  status: StickerStatus;
  quantity: number;
  updatedAt: string;
}

export interface Team {
  code: string; // e.g., 'BRA', 'ARG'
  name: string; // e.g., 'Brasil'
  group: string; // e.g., 'Grupo A'
  flagUrl: string; // computed or styled
}

export interface Sticker {
  id: string; // e.g., 'BRA-01'
  teamCode: string;
  number: number;
  name: string; // e.g., 'Escudo', 'Time', 'Neymar Jr' etc.
  isSpecial?: boolean;
}

export interface Chat {
  id: string; // sorted combination: uid1_uid2
  participants: string[];
  participantDetails: {
    [uid: string]: {
      displayName: string;
      photoURL?: string;
      whatsapp?: string;
    };
  };
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

// Visual Match Interfaces
export interface SingleMatch {
  stickerId: string;
  stickerName: string;
  partnerUid: string;
  partnerName: string;
  partnerWhatsapp?: string;
  partnerEmail?: string;
  type: 'he_has_my_missing' | 'i_have_his_missing';
}

export interface DoubleMatch {
  partnerUid: string;
  partnerName: string;
  partnerWhatsapp?: string;
  partnerEmail?: string;
  myRepeated: string[]; // Stickers I give
  myMissing: string[];  // Stickers I get
}

export interface ToastNotification {
  id: string;
  title: string;
  description: string;
  partnerUid: string;
  partnerName: string;
  partnerWhatsapp?: string;
  partnerEmail?: string;
  myRepeated?: string[];
  myMissing?: string[];
}

