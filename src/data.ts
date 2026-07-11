/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Team, Sticker } from './types';

export const TEAMS: Team[] = [
  // Grupo A
  { code: 'MEX', name: 'México', group: 'Grupo A', flagUrl: '🇲🇽' },
  { code: 'RSA', name: 'África do Sul', group: 'Grupo A', flagUrl: '🇿🇦' },
  { code: 'KOR', name: 'Coreia do Sul', group: 'Grupo A', flagUrl: '🇰🇷' },
  { code: 'CZE', name: 'República Tcheca', group: 'Grupo A', flagUrl: '🇨🇿' },

  // Grupo B
  { code: 'CAN', name: 'Canadá', group: 'Grupo B', flagUrl: '🇨🇦' },
  { code: 'BIH', name: 'Bósnia e Herzegovina', group: 'Grupo B', flagUrl: '🇧🇦' },
  { code: 'QAT', name: 'Catar', group: 'Grupo B', flagUrl: '🇶🇦' },
  { code: 'SUI', name: 'Suíça', group: 'Grupo B', flagUrl: '🇨🇭' },

  // Grupo C
  { code: 'BRA', name: 'Brasil', group: 'Grupo C', flagUrl: '🇧🇷' },
  { code: 'MAR', name: 'Marrocos', group: 'Grupo C', flagUrl: '🇲🇦' },
  { code: 'HAI', name: 'Haiti', group: 'Grupo C', flagUrl: '🇭🇹' },
  { code: 'SCO', name: 'Escócia', group: 'Grupo C', flagUrl: '🏴\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}' },

  // Grupo D
  { code: 'USA', name: 'Estados Unidos', group: 'Grupo D', flagUrl: '🇺🇸' },
  { code: 'PAR', name: 'Paraguai', group: 'Grupo D', flagUrl: '🇵🇾' },
  { code: 'AUS', name: 'Austrália', group: 'Grupo D', flagUrl: '🇦🇺' },
  { code: 'TUR', name: 'Turquia', group: 'Grupo D', flagUrl: '🇹🇷' },

  // Grupo E
  { code: 'GER', name: 'Alemanha', group: 'Grupo E', flagUrl: '🇩🇪' },
  { code: 'CUW', name: 'Curaçao', group: 'Grupo E', flagUrl: '🇨🇼' },
  { code: 'CIV', name: 'Costa do Marfim', group: 'Grupo E', flagUrl: '🇨🇮' },
  { code: 'ECU', name: 'Equador', group: 'Grupo E', flagUrl: '🇪🇨' },

  // Grupo F
  { code: 'NED', name: 'Holanda', group: 'Grupo F', flagUrl: '🇳🇱' },
  { code: 'JPN', name: 'Japão', group: 'Grupo F', flagUrl: '🇯🇵' },
  { code: 'SWE', name: 'Suécia', group: 'Grupo F', flagUrl: '🇸🇪' },
  { code: 'TUN', name: 'Tunísia', group: 'Grupo F', flagUrl: '🇹🇳' },

  // Grupo G
  { code: 'BEL', name: 'Bélgica', group: 'Grupo G', flagUrl: '🇧🇪' },
  { code: 'EGY', name: 'Egito', group: 'Grupo G', flagUrl: '🇪🇬' },
  { code: 'IRN', name: 'Irã', group: 'Grupo G', flagUrl: '🇮🇷' },
  { code: 'NZL', name: 'Nova Zelândia', group: 'Grupo G', flagUrl: '🇳🇿' },

  // Grupo H
  { code: 'ESP', name: 'Espanha', group: 'Grupo H', flagUrl: '🇪🇸' },
  { code: 'CPV', name: 'Cabo Verde', group: 'Grupo H', flagUrl: '🇨🇻' },
  { code: 'KSA', name: 'Arábia Saudita', group: 'Grupo H', flagUrl: '🇸🇦' },
  { code: 'URU', name: 'Uruguai', group: 'Grupo H', flagUrl: '🇺🇾' },

  // Grupo I
  { code: 'FRA', name: 'França', group: 'Grupo I', flagUrl: '🇫🇷' },
  { code: 'SEN', name: 'Senegal', group: 'Grupo I', flagUrl: '🇸🇳' },
  { code: 'IRQ', name: 'Iraque', group: 'Grupo I', flagUrl: '🇮🇶' },
  { code: 'NOR', name: 'Noruega', group: 'Grupo I', flagUrl: '🇳🇴' },

  // Grupo J
  { code: 'ARG', name: 'Argentina', group: 'Grupo J', flagUrl: '🇦🇷' },
  { code: 'ALG', name: 'Argélia', group: 'Grupo J', flagUrl: '🇩🇿' },
  { code: 'AUT', name: 'Áustria', group: 'Grupo J', flagUrl: '🇦🇹' },
  { code: 'JOR', name: 'Jordânia', group: 'Grupo J', flagUrl: '🇯🇴' },

  // Grupo K
  { code: 'POR', name: 'Portugal', group: 'Grupo K', flagUrl: '🇵🇹' },
  { code: 'COD', name: 'RD Congo', group: 'Grupo K', flagUrl: '🇨🇩' },
  { code: 'UZB', name: 'Uzbequistão', group: 'Grupo K', flagUrl: '🇺🇿' },
  { code: 'COL', name: 'Colômbia', group: 'Grupo K', flagUrl: '🇨🇴' },

  // Grupo L
  { code: 'ENG', name: 'Inglaterra', group: 'Grupo L', flagUrl: '🏴\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}' },
  { code: 'CRO', name: 'Croácia', group: 'Grupo L', flagUrl: '🇭🇷' },
  { code: 'GHA', name: 'Gana', group: 'Grupo L', flagUrl: '🇬🇭' },
  { code: 'PAN', name: 'Panamá', group: 'Grupo L', flagUrl: '🇵🇦' },

  // Especiais
  { code: 'COCA', name: 'Coca-Cola', group: 'ESPECIAIS', flagUrl: '🥤' }
];

export const SPECIAL_STICKERS: Sticker[] = [
  { id: '00', teamCode: 'FIFA', number: 0, name: 'FIFA 00', isSpecial: true },
  ...Array.from({ length: 19 }, (_, i) => ({
    id: `FWC${i + 1}`,
    teamCode: 'FIFA',
    number: i + 1,
    name: `FWC ${i + 1}`,
    isSpecial: true
  }))
];

export const STICKERS: Sticker[] = (() => {
  const list: Sticker[] = [...SPECIAL_STICKERS];

  TEAMS.forEach((team) => {
    if (team.code === 'COCA') return;

    for (let i = 1; i <= 20; i++) {
      list.push({
        id: `${team.code}${i}`,
        teamCode: team.code,
        number: i,
        name: `${team.code} ${i}`,
        isSpecial: i === 1 // Only escudo (number 1) is shiny/special
      });
    }
  });

  // Generate Coca-Cola stickers as a special section (CC1 to CC14) under virtual team 'COCA'
  for (let i = 1; i <= 14; i++) {
    list.push({
      id: `CC${i}`,
      teamCode: 'COCA',
      number: i,
      name: `CC ${i}`,
      isSpecial: false
    });
  }

  return list;
})();

export const STICKERS_BY_TEAM = (() => {
  const map: Record<string, Sticker[]> = {
    FIFA: SPECIAL_STICKERS
  };
  TEAMS.forEach(t => {
    map[t.code] = STICKERS.filter(s => s.teamCode === t.code);
  });
  return map;
})();
