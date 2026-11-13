export interface BibleVerse {
  verse: number;
  text: string;
}

export interface BibleChapter {
  chapter: number;
  verses: BibleVerse[];
}

export interface BibleBook {
  id: string;
  name: string;
  testament: 'AT' | 'NT';
  chapters: BibleChapter[];
}

export const BIBLE_FR_LSG: BibleBook[] = [
  {
    id: 'GEN',
    name: 'Genèse',
    testament: 'AT',
    chapters: [
      {
        chapter: 1,
        verses: [
          { verse: 1, text: 'Au commencement, Dieu créa les cieux et la terre.' },
          { verse: 2, text: 'La terre était informe et vide : il y avait des ténèbres à la surface de l’abîme, et l’esprit de Dieu se mouvait au-dessus des eaux.' },
          { verse: 3, text: 'Dieu dit : Que la lumière soit ! Et la lumière fut.' },
          { verse: 27, text: 'Dieu créa l’homme à son image, il le créa à l’image de Dieu, il créa l’homme et la femme.' },
        ],
      },
    ],
  },
  {
    id: 'PSA',
    name: 'Psaumes',
    testament: 'AT',
    chapters: [
      {
        chapter: 23,
        verses: [
          { verse: 1, text: 'L’Éternel est mon berger : je ne manquerai de rien.' },
          { verse: 2, text: 'Il me fait reposer dans de verts pâturages, il me dirige près des eaux paisibles.' },
          { verse: 3, text: 'Il restaure mon âme, il me conduit dans les sentiers de la justice, à cause de son nom.' },
          { verse: 4, text: 'Quand je marche dans la vallée de l’ombre de la mort, je ne crains aucun mal, car tu es avec moi : ta houlette et ton bâton me rassurent.' },
          { verse: 6, text: 'Oui, le bonheur et la grâce m’accompagneront tous les jours de ma vie, et j’habiterai dans la maison de l’Éternel jusqu’à la fin de mes jours.' },
        ],
      },
      {
        chapter: 91,
        verses: [
          { verse: 1, text: 'Celui qui demeure sous l’abri du Très-Haut repose à l’ombre du Tout-Puissant.' },
          { verse: 2, text: 'Je dis à l’Éternel : Mon refuge et ma forteresse, mon Dieu en qui je me confie !' },
          { verse: 11, text: 'Car il ordonnera à ses anges de te garder dans toutes tes voies.' },
        ],
      },
      {
        chapter: 121,
        verses: [
          { verse: 1, text: 'Je lève mes yeux vers les montagnes... D’où me viendra le secours ?' },
          { verse: 2, text: 'Le secours me vient de l’Éternel, qui a fait les cieux et la terre.' },
        ],
      },
    ],
  },
  {
    id: 'PRO',
    name: 'Proverbes',
    testament: 'AT',
    chapters: [
      {
        chapter: 3,
        verses: [
          { verse: 5, text: 'Confie-toi en l’Éternel de tout ton cœur, et ne t’appuie pas sur ta sagesse ;' },
          { verse: 6, text: 'Reconnais-le dans toutes tes voies, et il aplanira tes sentiers.' },
        ],
      },
      {
        chapter: 19,
        verses: [
          { verse: 17, text: 'Celui qui a pitié du pauvre prête à l’Éternel, qui lui rendra selon son œuvre.' },
        ],
      },
    ],
  },
  {
    id: 'MAT',
    name: 'Matthieu',
    testament: 'NT',
    chapters: [
      {
        chapter: 5,
        verses: [
          { verse: 3, text: 'Heureux les pauvres en esprit, car le royaume des cieux est à eux !' },
          { verse: 9, text: 'Heureux ceux qui procurent la paix, car ils seront appelés fils de Dieu !' },
          { verse: 14, text: 'Vous êtes la lumière du monde. Une ville située sur une montagne ne peut être cachée.' },
          { verse: 16, text: 'Que votre lumière luise ainsi devant les hommes, afin qu’ils voient vos bonnes œuvres, et qu’ils glorifient votre Père qui est dans les cieux.' },
        ],
      },
      {
        chapter: 25,
        verses: [
          { verse: 35, text: 'Car j’ai eu faim, et vous m’avez donné à manger ; j’ai eu soif, et vous m’avez donné à boire ; j’étais étranger, et vous m’avez recueilli.' },
          { verse: 40, text: 'Toutes les fois que vous avez fait ces choses à l’un de ces plus petits de mes frères, c’est à moi que vous les avez faites.' },
        ],
      },
    ],
  },
  {
    id: 'JHN',
    name: 'Jean',
    testament: 'NT',
    chapters: [
      {
        chapter: 1,
        verses: [
          { verse: 1, text: 'Au commencement était la Parole, et la Parole était avec Dieu, et la Parole était Dieu.' },
          { verse: 5, text: 'La lumière luit dans les ténèbres, et les ténèbres ne l’ont point reçue.' },
        ],
      },
      {
        chapter: 3,
        verses: [
          { verse: 16, text: 'Car Dieu a tant aimé le monde qu’il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu’il ait la vie éternelle.' },
        ],
      },
      {
        chapter: 13,
        verses: [
          { verse: 34, text: 'Je vous donne un commandement nouveau : Aimez-vous les uns les autres ; comme je vous ai aimés, vous aussi, aimez-vous les uns les autres.' },
          { verse: 35, text: 'À ceci tous connaîtront que vous êtes mes disciples, si vous avez de l’amour les uns pour les autres.' },
        ],
      },
    ],
  },
  {
    id: 'ROM',
    name: 'Romains',
    testament: 'NT',
    chapters: [
      {
        chapter: 8,
        verses: [
          { verse: 28, text: 'Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu, de ceux qui sont appelés selon son dessein.' },
          { verse: 38, text: 'Car j’ai l’assurance que ni la mort ni la vie, ni les anges ni les dominations, ni les choses présentes ni les choses à venir,' },
          { verse: 39, text: 'Ni la hauteur ni la profondeur, ni aucune autre créature ne pourra nous séparer de l’amour de Dieu manifesté en Jésus-Christ notre Seigneur.' },
        ],
      },
      {
        chapter: 12,
        verses: [
          { verse: 12, text: 'Réjouissez-vous en espérance. Soyez patients dans l’affliction. Persévérez dans la prière.' },
          { verse: 13, text: 'Pourvoyez aux besoins des saints. Exercez l’hospitalité.' },
        ],
      },
    ],
  },
  {
    id: '1CO',
    name: '1 Corinthiens',
    testament: 'NT',
    chapters: [
      {
        chapter: 13,
        verses: [
          { verse: 4, text: 'La charité est patiente, elle est pleine de bonté ; la charité n’est point envieuse ; la charité ne se vante point, elle ne s’enfle point d’orgueil,' },
          { verse: 7, text: 'Elle excuse tout, elle croit tout, elle espère tout, elle supporte tout.' },
          { verse: 13, text: 'Maintenant donc ces trois choses demeurent : la foi, l’espérance, la charité ; mais la plus grande de ces choses, c’est la charité.' },
        ],
      },
    ],
  },
  {
    id: 'PHP',
    name: 'Philippiens',
    testament: 'NT',
    chapters: [
      {
        chapter: 4,
        verses: [
          { verse: 6, text: 'Ne vous inquiétez de rien ; mais en toute chose faites connaître vos besoins à Dieu par des prières et des supplications, avec des actions de grâces.' },
          { verse: 7, text: 'Et la paix de Dieu, qui surpasse toute intelligence, gardera vos cœurs et vos pensées en Jésus-Christ.' },
          { verse: 13, text: 'Je puis tout par celui qui me fortifie.' },
        ],
      },
    ],
  },
];

export function searchBibleVerses(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: { reference: string; text: string; bookId: string; chapter: number; verse: number }[] = [];
  for (const book of BIBLE_FR_LSG) {
    for (const ch of book.chapters) {
      for (const v of ch.verses) {
        const ref = `${book.name} ${ch.chapter}:${v.verse}`;
        if (v.text.toLowerCase().includes(q) || ref.toLowerCase().includes(q)) {
          results.push({
            reference: ref,
            text: v.text,
            bookId: book.id,
            chapter: ch.chapter,
            verse: v.verse,
          });
        }
      }
    }
  }
  return results;
}
