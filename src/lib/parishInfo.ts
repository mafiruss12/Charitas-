export interface ParishLeaderContact {
  name: string;
  role: string;
  phone: string;
  displayPhone: string;
}

export const OFFICIAL_PARISH_NAME = 'CHARITAS — Église Saint Louis Roi d’Ebimpé';
export const OFFICIAL_PARISH_LOGO = '/assets/aistudio/IMG-20261115-WA0014_7d3ce8f2.jpg';

export const PARISH_LEADERS_CONTACTS: ParishLeaderContact[] = [
  {
    name: 'Ako Vince',
    role: 'Responsable Paroissial CHARITAS',
    phone: '0747160619',
    displayPhone: '07 47 16 06 19',
  },
  {
    name: 'Emmanuel Tanoh',
    role: 'Responsable & Coordination',
    phone: '0747417231',
    displayPhone: '07 47 41 72 31',
  },
  {
    name: 'Some Séraphin',
    role: 'Responsable & Permanence',
    phone: '0505627855',
    displayPhone: '05 05 62 78 55',
  },
];

export const POWERED_BY_CREDIT = 'Powered by Kevin Akoh de Kevin Tech Pro';
