/**
 * Alleen airco's als warmtebron (besluit 342, issue 170). Wie bij Energie of Inrichten kiest dat het huis alleen met
 * airco's verwarmt, krijgt per kamer een airco die de kamer op temperatuur houdt: in elke kamer waar nog niets dat
 * doet, gaat de eerste airco van Helpt op zon naar Houdt op temperatuur. Eenmalig, bij het kiezen; wat de bewoner
 * daarna per kamer kiest, blijft staan.
 */
import type { HouseReport } from './house-types.js';
import type { Layout } from './layout.js';
import type { Rol } from './regeling.js';

/** De indeling met de airco's die nu de kamer houden, of null als er niets verandert. */
export function aircosHouden(layout: Layout | null, huis: HouseReport | null): Layout | null {
  if (layout == null || huis == null) return null;
  const kamers = huis.etages.flatMap((e) => e.ruimtes);
  let veranderd = false;
  const nieuw = layout.kamers.map((k) => {
    const r = kamers.find((x) => x.id === k.id);
    if (!r) return k;
    const klimaat = r.apparaten.filter((a) => a.soort === 'klimaat' && a.klimaat != null);
    const sleutel = (a: (typeof klimaat)[number]): string => a.actuatorId ?? a.id;
    // De rollen zoals ze nu zijn: wat de indeling zegt, anders wat het huis laat zien.
    const rollen: Record<string, Rol> = Object.fromEntries(klimaat.map((a) => [sleutel(a), (k.rollen?.[sleutel(a)] ?? a.klimaat!.rol) as Rol]));
    if (Object.values(rollen).includes('houdt')) return k;
    const airco = klimaat.find((a) => a.klimaat!.kanKoelen && a.klimaat!.kanVerwarmen && rollen[sleutel(a)] === 'zon');
    if (!airco) return k;
    veranderd = true;
    return { ...k, rollen: { ...(k.rollen ?? {}), ...rollen, [sleutel(airco)]: 'houdt' as Rol } };
  });
  return veranderd ? { ...layout, kamers: nieuw } : null;
}
