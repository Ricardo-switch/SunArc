/**
 * Herinneringen en Te doen (uit main.ts, 23 november 2026; besluiten 216-218): de lijsten van Home Assistant, en elke
 * vijftien seconden wat er gepland staat uitvoeren of melden. Alleen verhuisd.
 */
import { Herinneringen, type Herinnering } from '../web/tedoen.js';
import { logDir, inHuisMetDeuren } from './begin.js';
import { volgendeMoment } from '../web/gepland.js';
import { volledig, functiesVoorstel } from '../web/functies.js';
import { type TeDoenDienst } from '../web/routes/tedoen.js';
import { type GeplandeDeuren, voerStapUit } from '../web/gepland-uit.js';
import { telefoonVan, alsMelding } from '../web/push.js';
import type { MaakHerinneringenNodig } from '../main.js';

export function maakHerinneringen(nodig: MaakHerinneringenNodig) {
  const {
    allStates, bewonersStore, client, functiesKeuzes, functiesNu, handKnoppen, handbediening, klimaatAan, klopt,
    runner, stekkerhand, telefoonDeur, telefoons, voorkeuren,
  } = nodig;
  /*
   * Te doen (besluit 216): de herinneringen in een eigen bestand, en op het
   * tijdstip een melding naar de telefoon van wie hem vroeg (alleen in de
   * add-on). De wand vraagt zelf wat er speelt en zegt het hardop.
   */
  const herinneringen = new Herinneringen({
    map: logDir !== '' ? logDir : null,
    // Vast en gepland (besluit 234): na elke keer het volgende moment, op de klok en de zon van hier.
    volgende: (o, vanMs) => (o.moment && o.herhaal ? volgendeMoment(o.moment, o.herhaal, vanMs, nodig.siteConfig?.timezone ?? 'Europe/Amsterdam', nodig.location) : null),
  });
  const teDoenKeus = () => {
    const f = functiesNu();
    return volledig(f ?? functiesVoorstel(functiesKeuzes() ?? { cameras: [], melders: [] }), functiesKeuzes()).tedoen;
  };
  const bewonerNaam = (account: string): string | null => {
    const b = bewonersStore?.current;
    const id = b?.volgorde.find((x) => b.bewoners[x]?.haUser === account && !b.bewoners[x]?.gast);
    return id ? (b!.bewoners[id]!.naam ?? null) : null;
  };
  const teDoen: TeDoenDienst = {
    keus: teDoenKeus,
    herinneringen,
    leesAgendas: (ids, van, tot) => client.leesAgendas(ids, van, tot),
    leesLijsten: (ids) => client.leesLijsten(ids),
    lijst: async (id, item, actie) => {
      if (actie === 'opruimen') await client.callService('todo', 'remove_completed_items', {}, { entity_id: id });
      else if (actie === 'toevoegen') await client.callService('todo', 'add_item', { item }, { entity_id: id });
      else await client.callService('todo', 'update_item', { item, status: actie === 'klaar' ? 'completed' : 'needs_action' }, { entity_id: id });
    },
    agendaVan: (account) => voorkeuren?.agenda(account) ?? { aan: true, ids: [] },
    naamVan: bewonerNaam,
    // Wie er thuis is, zoals de regeling het ziet (besluit 219): hun eigen agenda's staan dan op de wand.
    thuis: () => {
      const b = bewonersStore?.current;
      if (!b) return [];
      return (runner?.latest?.explanation.profile?.home ?? []).flatMap((id) => {
        const x = b.bewoners[id];
        return x && !x.gast && x.haUser ? [{ account: x.haUser, naam: x.naam ?? '' }] : [];
      });
    },
    namen: (ids) => Object.fromEntries(ids.map((id) => [id, String(allStates.get(id)?.attributes['friendly_name'] ?? id)])),
    agendas: () =>
      [...allStates.values()]
        .filter((s) => /^calendar\.[a-z0-9_]+$/.test(s.entity_id) && s.state !== 'unavailable')
        .map((s) => ({ id: s.entity_id, naam: String(s.attributes['friendly_name'] ?? s.entity_id) }))
        .sort((a, b) => a.naam.localeCompare(b.naam, 'nl')),
  };
  /**
   * Een geplande opdracht uitvoeren (besluit 218): dezelfde deuren als de
   * pagina, binnen wat bij Functies aan staat. Wat niet mag of niet lukt, komt
   * in het logboek.
   */
  async function voerGeplandUit(h: Herinnering): Promise<void> {
    // Licht en schermen worden in main.ts pas na dit stuk aangemaakt: hier de stand van nu.
    const { lightSwitch, coverSwitch } = nodig;
    const f = functiesNu();
    const vol = f ? volledig(f, functiesKeuzes()) : null;
    const mag = vol?.licht.bedienen !== false;
    // Klimaat met de hand en witgoed (besluit 240): dezelfde deuren als besluit 235 en 238.
    const hand = handbediening && klimaatAan() ? handbediening : null;
    const deuren: GeplandeDeuren = {
      licht: lightSwitch && mag ? (b) => lightSwitch.switch(b) : null,
      scene: lightSwitch?.scenesEnabled && mag ? (b) => lightSwitch.scene(b) : null,
      scherm: coverSwitch && vol?.schermen.bedienen !== false ? (b) => coverSwitch.move(b) : null,
      hand: hand
        ? {
            zet: (id, modus, doelC, totMs, totDoel) => hand.zet(id, modus, doelC, totMs, totDoel),
            zetKnop: (id, doelC, totMs, totDoel) => hand.zetKnop(id, doelC, totMs, totDoel),
            schakelAan: (id, totMs) => hand.schakelAan(id, totMs),
            isKnop: (id) => handKnoppen().some((k) => k.id === id),
          }
        : null,
      witgoed: nodig.witgoed ? (id) => nodig.witgoed!.nuStarten(id) : null,
      // Een slimme stekker op een vaste tijd (besluit 266): dezelfde deur als met de hand (265).
      stekker: inHuisMetDeuren ? async (id, aan, tot) => {
        const r = await stekkerhand.zet(id, aan, tot);
        return r.ok ? { ok: true } : { ok: false, reden: r.reden };
      } : null,
      tz: nodig.siteConfig?.timezone ?? 'Europe/Amsterdam',
    };
    for (const s of h.opdracht?.stappen ?? []) {
      const r = await voerStapUit(s, deuren);
      if (r == null) console.warn(`[gepland] ${s.pad} staat niet aan; "${h.tekst}" niet gedaan`);
      else if (!r.ok) console.warn(`[gepland] "${h.tekst}" lukte niet: ${r.reden ?? ''}`);
      // Niet gedaan: dat hoort de bewoner te zien (besluit 314), een dag lang.
      if (r == null || !r.ok) klopt.meld({ soort: 'gepland', id: h.tekst, tekst: h.tekst, sindsMs: Date.now() }, 24 * 3_600_000);
    }
  }

  let herinnerBezig = false;
  async function herinnerRonde(): Promise<void> {
    if (herinnerBezig) return;
    herinnerBezig = true;
    try {
      const alles = await herinneringen.ronde();
      // Geplande opdrachten voert de dienst zelf uit; ze gaan niet als melding naar een telefoon.
      // Overslaan als niemand thuis is (besluit 234): alleen wie dat bij de opdracht koos.
      const niemand = runner?.latest?.explanation.occupied === false;
      for (const g of alles.filter((x) => x.opdracht)) {
        if (g.opdracht?.overslaanWeg && niemand) {
          console.log(`[gepland] "${g.tekst}" overgeslagen: niemand thuis`);
          continue;
        }
        await voerGeplandUit(g).catch((error: unknown) => console.warn(`[gepland] ${(error as Error).message}`));
      }
      const nieuw = alles.filter((x) => !x.opdracht);
      // Een melding naar de telefoon van wie hem vroeg; een herinnering voor het huis alleen op de wand.
      if (!telefoonDeur || !voorkeuren) return;
      for (const h of nieuw) {
        if (h.voor == null) continue;
        const t = telefoonVan(h.voor, voorkeuren.meldingen(h.voor), telefoons());
        if (!t) continue;
        const nl = voorkeuren.taal(h.voor) !== 'en';
        try {
          await client.callService('notify', t.dienst, alsMelding({ dienst: t.dienst, titel: nl ? 'Te doen' : 'To do', tekst: h.tekst, tag: `smart-climate-tedoen-${h.id}`, dringend: true, stil: false }, nodig.paneelPad), {});
        } catch (error) {
          console.warn(`Herinnering naar ${t.dienst} lukte niet: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      console.warn(`[te doen] ${(error as Error).message}`);
    } finally {
      herinnerBezig = false;
    }
  }
  setInterval(() => void herinnerRonde(), 15_000).unref();
  return { teDoen };
}
