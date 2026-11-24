/** Getallen in de taal (besluit 344): de decimale komma of punt uit taal/<taal>.ts. */
import type { Lang } from '../web/assistant-types.js';
import { perTaal } from './index.js';

const ALGEMEEN = perTaal('algemeen');

/** Het eerste decimaalteken in een getal als tekst zoals de taal het schrijft: "2.5" wordt in het Nederlands "2,5". */
export const komma = (s: string, lang: Lang): string => s.replace('.', ALGEMEEN[lang].decimaal);

/** De gedeelde taaleigenschappen: codes voor stem en verstaan, en hoe een maand midden in een zin staat. */
export const algemeen = (lang: Lang) => ALGEMEEN[lang];
