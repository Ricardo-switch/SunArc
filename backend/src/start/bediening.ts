/**
 * Bedienen met de hand (uit main.ts): de klimaatbrug (besluit 210), klimaat met de hand (235), laden
 * (262), de slimme stekkers met de hand en op zon (265, 267), de schakelaars (297) en de kinderslotten (299). Alleen
 * verhuisd, niets veranderd.
 */
import { KlimaatBrug } from '../web/klimaatbrug.js';
import { inHuisMetDeuren, logDir } from './begin.js';
import { volledig } from '../web/functies.js';
import { Handbediening, HAND_KLIMAAT } from '../web/hand.js';
import { laadBedieningen, metLosseLaadpalen } from '../web/opslag.js';
import { Laadhand } from '../web/laadhand.js';
import { type StekkerBekend, Stekkerhand } from '../web/stekkerhand.js';
import { StekkerZon } from '../web/stekkerzon.js';
import { type FoundHeatStore, findHeatStores, findPlugs } from '../web/buffers-vinden.js';
import { type SchakelaarKeuzes, schakelaarsOpZon, vindSchakelaars, SchakelaarStore, GEEN_KEUZES, type GevondenSchakelaar, kinderslotVan } from '../web/schakelaars.js';
import { type HaDevice, type HaRegistryEntity } from '../adapters/homeassistant/discovery.js';
import { type HuisStekker } from '../web/house.js';
import type { MaakBedieningNodig } from '../main.js';

export async function maakBediening(nodig: MaakBedieningNodig) {
  const {
    allStates, client, connectionStore, klopt,
  } = nodig;
  /*
   * De klimaatbrug (besluit 210): tot stap B de knoppen van het oude systeem,
   * als de bewoner dat bij Functies aanzet. Alleen in de add-on: de NAS kijkt
   * mee en blijft eraf, anders zou een opdracht twee keer gaan. Elke minuut zet
   * hij terug wat voorbij zijn tijd is, ook als de brug intussen uit ging.
   */
  const klimaatBrug: KlimaatBrug | null = inHuisMetDeuren
    ? new KlimaatBrug({
        state: (id) => allStates.get(id),
        zet: (knop, waarde): Promise<void> => client.callService('input_number', 'set_value', { value: waarde }, { entity_id: knop }),
        kies: (select, optie): Promise<void> => client.callService('input_select', 'select_option', { option: optie }, { entity_id: select }),
        map: logDir !== '' ? logDir : null,
      })
    : null;
  function klimaatAan(): boolean {
    const f = klimaatBrug ? nodig.functiesNu() : null;
    return f != null && volledig(f, nodig.functiesKeuzes()).praten.klimaat;
  }
  /*
   * Klimaat met de hand (besluit 235): elk apparaat via zijn knop, de airco's op
   * warm ook zelf, en een stekker met een warmtebron die niet in de regeling zit.
   * Alleen in de add-on en als de brug aan staat, net als de klimaatbrug.
   */

  const handbediening: Handbediening | null = inHuisMetDeuren
    ? new Handbediening({
        state: (id) => allStates.get(id),
        zet: (knop, waarde): Promise<void> => client.callService('input_number', 'set_value', { value: waarde }, { entity_id: knop }),
        kies: (select, optie): Promise<void> => client.callService('input_select', 'select_option', { option: optie }, { entity_id: select }),
        klimaat: async (id, stand): Promise<void> => {
          if (stand === 'uit') return client.callService('climate', 'turn_off', {}, { entity_id: id });
          await client.callService('climate', 'set_hvac_mode', { hvac_mode: 'heat' }, { entity_id: id });
          await client.callService('climate', 'set_temperature', { temperature: stand.warm }, { entity_id: id });
        },
        schakel: (id, aan): Promise<void> => client.callService('switch', aan ? 'turn_on' : 'turn_off', {}, { entity_id: id }),
        temperatuur: (id, c): Promise<void> => client.callService('climate', 'set_temperature', { temperature: c }, { entity_id: id }),
        // Drogen of ventileren, en welke kachel in het tuinhuis (besluit 319).
        stand: (id, hvac): Promise<void> => client.callService('climate', 'set_hvac_mode', { hvac_mode: hvac }, { entity_id: id }),
        voorinstelling: (id, preset): Promise<void> => client.callService('climate', 'set_preset_mode', { preset_mode: preset }, { entity_id: id }),
        map: logDir !== '' ? logDir : null,
      })
    : null;
  /** Wat er per auto met de hand te bedienen is (besluit 262). */
  function laadBedieningenNu() {
    return nodig.houseRegisters ? laadBedieningen(laadReg(nodig.houseRegisters), allStates, connectionStore?.current?.laden ?? null) : [];
  }
  /*
   * Laden met de hand (besluit 262, stap 5 van besluit 259): de hoogste
   * laadstroom of pauzeren, met een eind. Alleen in de add-on (en het
   * voorbeeldhuis), zoals klimaat met de hand; de NAS kijkt mee.
   */
  const laadhand: Laadhand | null = inHuisMetDeuren
    ? new Laadhand({
        state: (id) => allStates.get(id),
        zetStroom: (id, a): Promise<void> => client.callService('number', 'set_value', { value: a }, { entity_id: id }),
        schakel: (id, aan): Promise<void> => client.callService('switch', aan ? 'turn_on' : 'turn_off', {}, { entity_id: id }),
        druk: (id): Promise<void> => client.callService('button', 'press', {}, { entity_id: id }),
        easee: (apparaat, dienst, data): Promise<void> => client.callService('easee', dienst, { device_id: apparaat, ...data }, {}),
        kies: (id, optie): Promise<void> => client.callService('select', 'select_option', { option: optie }, { entity_id: id }),
        auto: (id) => nodig.huisNu('nl')?.opslag?.autos.find((a) => a.id === id) ?? null,
        bediening: (id) => laadBedieningenNu().find((b) => b.auto === id) ?? null,
        zekeringA: (id) => nodig.zekeringVoor(id),
        map: logDir !== '' ? logDir : null,
      })
    : null;
  /*
   * Een slimme stekker met de hand (besluit 265): aan of uit met een eind,
   * alleen de stekkers die de bewoner toeliet. Schakelen alleen met de deuren open (add-on of HEMS_DEUREN, besluit 309);
   * elders kijkt het blad mee.
   */
  function stekkersBekend(): StekkerBekend[] {
    // Toegelaten in het blad, of op zon: op zon is zelf de toestemming (besluit 290).
    const mag = new Set((connectionStore?.current?.buffers ?? []).filter((b) => b.bedienen === true || (b.soort === 'stekker' && b.opZon)).map((b) => b.id));
    return vindBuffers()
      .filter((b) => b.soort === 'stekker')
      .map((b) => ({ id: b.id, naam: b.naam, actuator: b.actuator, ...(b.power ? { power: b.power } : {}), mag: mag.has(b.id) }));
  }
  const stekkerhand = new Stekkerhand({
    state: (id) => allStates.get(id),
    schakel: (id, aan): Promise<void> => client.callService('switch', aan ? 'turn_on' : 'turn_off', {}, { entity_id: id }),
    stekkers: stekkersBekend,
    tijdzone: () => nodig.siteConfig?.timezone ?? 'Europe/Amsterdam',
    map: inHuisMetDeuren && logDir !== '' ? logDir : null,
  });
  /*
   * Een stekker op zon, echt geschakeld (besluit 267): wat de regeling zegt, zet
   * SunArc door, alleen bij een stekker die op zon staat en die de bewoner
   * toeliet, en alleen met de deuren open (add-on of HEMS_DEUREN, besluit 309).
   */
  const stekkerZon = new StekkerZon({
    state: (id) => allStates.get(id),
    schakel: (id, aan): Promise<void> => client.callService('switch', aan ? 'turn_on' : 'turn_off', {}, { entity_id: id }),
    stekkers: stekkersBekend,
    opZon: () => new Set((nodig.siteConfig?.heatStores ?? []).filter((h) => h.kind === 'stekker').map((h) => h.id)),
    metDeHand: () => new Set(stekkerhand.terugzetten.map((t) => t.id)),
    aan: () => inHuisMetDeuren,
    tijdzone: () => nodig.siteConfig?.timezone ?? 'Europe/Amsterdam',
    map: inHuisMetDeuren && logDir !== '' ? logDir : null,
    write: (r) => console.log(r),
  });
  if (inHuisMetDeuren) {
    setInterval(() => {
      stekkerhand.ronde().then(
        (gedaan) => {
          klopt.gelukt('terug', 'stekker');
          gedaan.forEach((g) => console.log(`[stekker met de hand] ${g}`));
        },
        (e: unknown) => {
          klopt.meld({ soort: 'terug', id: 'stekker', naam: 'Een stekker', sindsMs: Date.now() });
          console.warn(`[stekker met de hand] terugzetten lukte niet: ${(e as Error).message}`);
        },
      );
    }, 60_000).unref();
  }
  if (laadhand) {
    setInterval(() => {
      laadhand.ronde().then(
        (gedaan) => {
          klopt.gelukt('terug', 'laden');
          gedaan.forEach((g) => console.log(`[laden met de hand] ${g}`));
        },
        (e: unknown) => {
          klopt.meld({ soort: 'terug', id: 'laden', naam: 'Het laden van de auto', sindsMs: Date.now() });
          console.warn(`[laden met de hand] terugzetten lukte niet: ${(e as Error).message}`);
        },
      );
    }, 60_000).unref();
  }
  /**
   * De boiler en de jacuzzi (besluit 186) en de slimme stekkers (besluit 264),
   * zoals ze nu in Home Assistant staan. Een schakelaar die de regeling al
   * bedient, is geen losse stekker.
   */
  function vindBuffersHa(): FoundHeatStore[] {
    if (!nodig.houseRegisters) return [];
    const buffers = findHeatStores(allStates, nodig.houseRegisters.entities, nodig.houseRegisters.devices);
    const bekend = new Set([...(nodig.siteConfig?.actuators ?? []).map((a) => a.ref.id), ...buffers.map((b) => b.actuator)]);
    return [...buffers, ...findPlugs(allStates, nodig.houseRegisters.entities, nodig.houseRegisters.devices, bekend)];
  }
  /** Met de schakelaars die op zon kunnen (besluit 304): die doen mee als een stekker. */
  function vindBuffers(): FoundHeatStore[] {
    const ha = vindBuffersHa();
    if (!nodig.houseRegisters) return ha;
    const bekend = new Set([...(nodig.siteConfig?.actuators ?? []).map((a) => a.ref.id), ...ha.map((b) => b.actuator)]);
    // Bij het opstarten bestaat het bestand met de keuzes nog niet: dan alleen wat Home Assistant heeft.
    let keuzes: SchakelaarKeuzes;
    try {
      keuzes = schakelaarKeuzes();
    } catch {
      return ha;
    }
    return [...ha, ...schakelaarsOpZon(vindSchakelaars(allStates, nodig.houseRegisters.entities, nodig.houseRegisters.devices, bekend), keuzes)];
  }
  /*
   * Schakelaars (besluit 297): een relais zoals een Shelly 1 mini, klik-aan-klik-uit
   * of de knoppen van een IR-afstandsbediening. Wat het huis al kent (de regeling,
   * een boiler, een stekker), telt niet mee. De keuzes staan in een eigen bestand.
   */
  const schakelaarStore = logDir !== '' ? new SchakelaarStore(logDir) : null;
  await schakelaarStore?.load();
  const schakelaarKeuzes = (): SchakelaarKeuzes => schakelaarStore?.current ?? GEEN_KEUZES;
  /**
   * De registers met de laadpalen uit losse sensoren erbij (besluit 301), voor
   * alles over laden en de thuisaccu. Zolang de keuzes nog niet geladen zijn: zonder.
   */
  function laadReg<R extends { readonly devices: readonly HaDevice[]; readonly entities: readonly HaRegistryEntity[] }>(r: R): R {
    let laadpalen;
    try {
      laadpalen = schakelaarStore?.current?.laadpalen;
    } catch {
      laadpalen = undefined;
    }
    return metLosseLaadpalen(r, laadpalen);
  }
  /**
   * De slimme stekkers als apparaat in het huis (besluit 318), met het gebied
   * van Home Assistant als voorstel voor de kamer. Zo krijgt een stekker een
   * kamer, bij Je huis en in zijn eigen blad.
   */
  function stekkersVoorHuis(): HuisStekker[] {
    const reg = nodig.houseRegisters;
    if (!reg) return [];
    // Een stekker die bij een schakelaar hoort (de kachel in het tuinhuis, besluit 300), is daar al een deel van.
    let bijSchakelaar: Set<string>;
    try {
      bijSchakelaar = new Set(Object.values(schakelaarKeuzes().apparaten).flatMap((k) => (k.stekker ? [k.stekker] : [])));
    } catch {
      bijSchakelaar = new Set();
    }
    return vindBuffersHa()
      .filter((b) => b.soort === 'stekker' && !bijSchakelaar.has(b.id))
      .map((b) => {
        const e = reg.entities.find((x) => x.entity_id === b.actuator);
        const dev = e?.device_id ? reg.devices.find((d) => d.id === e.device_id) : undefined;
        return { id: b.id, naam: b.naam, actuator: b.actuator, gebied: e?.area_id ?? dev?.area_id ?? null };
      });
  }
  function vindSchakelaarsNu(): GevondenSchakelaar[] {
    if (!nodig.houseRegisters) return [];
    const bekend = new Set([...(nodig.siteConfig?.actuators ?? []).map((a) => a.ref.id), ...vindBuffersHa().map((b) => b.actuator)]);
    return vindSchakelaars(allStates, nodig.houseRegisters.entities, nodig.houseRegisters.devices, bekend);
  }
  /**
   * De kinderslotten (besluit 299), per klimaatapparaat (op zijn `climate.`) en
   * per witgoed (op zijn id uit de configuratie): het slot op hetzelfde apparaat
   * in Home Assistant.
   */
  function kinderslotten(): Record<string, { readonly id: string; readonly aan: boolean }> {
    if (!nodig.houseRegisters) return {};
    const uit: Record<string, { readonly id: string; readonly aan: boolean }> = {};
    for (const e of nodig.houseRegisters.entities) {
      if (!e.entity_id.startsWith('climate.')) continue;
      const s = kinderslotVan(e.entity_id, nodig.houseRegisters.entities, allStates);
      if (s) uit[e.entity_id] = s;
    }
    for (const d of nodig.siteConfig?.deferrables ?? []) {
      const s = kinderslotVan(d.remoteStart.id, nodig.houseRegisters.entities, allStates);
      if (s) uit[d.id] = s;
    }
    return uit;
  }

  /** De radiatorknoppen buiten de regeling (besluit 126), met hun kamer: die zet de hand direct (besluit 235). */
  function handKnoppen(): { id: string; naam: string; kamer: string; zone?: string }[] {
    // Een knop in een zone met een eigen regeling (besluit 306) mag ook met de hand: de bewoner koos dat.
    const zoneGebieden = new Set((nodig.layoutNu?.()?.kamers ?? []).flatMap((k) => k.zones.map((z) => z.regelzone).filter((x): x is string => x != null)));
    const inZone = new Set((nodig.siteConfig?.zones ?? []).filter((z) => zoneGebieden.has(z.id)).flatMap((z) => z.actuatorIds));
    const regeling = new Set((nodig.siteConfig?.actuators ?? []).filter((a) => !inZone.has(a.id)).map((a) => a.ref.id));
    return (nodig.houseReport()?.etages ?? []).flatMap((e) => e.ruimtes.flatMap((r) => r.apparaten.filter((a) => a.radiatorknop && a.id.startsWith('climate.') && !regeling.has(a.id)).map((a) => {
      // De zone die deze knop regelt, voor de zin in het blad.
      const zone = inZone.has(a.actuatorId ?? a.id) ? r.zones.find((z) => z.id === a.zone && z.regeling)?.naam : undefined;
      return { id: a.id, naam: a.naam, kamer: r.naam, ...(zone ? { zone } : {}) };
    })));
  }
  /**
   * Klimaat buiten de regeling (besluit 319), zoals het tuinhuis: een `climate.`
   * in het huis die geen apparaat van de regeling is, geen radiatorknop en geen
   * airco van de hand, en die alleen kan verwarmen. Met de hand: verwarmen of
   * uit, het doel, en zijn eigen voorinstellingen.
   */
  function losKlimaat(): { id: string; naam: string; kamer: string; voorinstellingen: string[] }[] {
    const regeling = new Set((nodig.siteConfig?.actuators ?? []).map((a) => a.ref.id));
    return (nodig.houseReport()?.etages ?? []).flatMap((e) =>
      e.ruimtes.flatMap((r) =>
        r.apparaten
          .filter((a) => a.soort === 'klimaat' && a.id.startsWith('climate.') && !a.radiatorknop && !regeling.has(a.id) && !regeling.has(a.actuatorId ?? '') && !HAND_KLIMAAT.includes(a.id))
          .filter((a) => {
            const modes = allStates.get(a.id)?.attributes['hvac_modes'];
            return Array.isArray(modes) && modes.includes('heat') && !modes.includes('cool');
          })
          .map((a) => {
            const p = allStates.get(a.id)?.attributes['preset_modes'];
            return { id: a.id, naam: a.naam, kamer: r.naam, voorinstellingen: Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [] };
          }),
      ),
    );
  }
  /** De stekkers met een warmtebron die niet in de regeling zitten (besluit 235). */
  function handSchakelaars(): { id: string; kamer: string; naam: string; aan: boolean }[] {
    const regeling = new Set((nodig.siteConfig?.actuators ?? []).map((a) => a.ref.id));
    return (nodig.layoutNu?.()?.kamers ?? []).flatMap((k) =>
      (k.bronnen ?? [])
        .filter((b) => b.aan !== 'hand' && b.apparaat?.startsWith('switch.') && !regeling.has(b.apparaat))
        .map((b) => ({ id: b.apparaat!, kamer: k.naam ?? k.id, naam: String(allStates.get(b.apparaat!)?.attributes['friendly_name'] ?? b.apparaat), aan: allStates.get(b.apparaat!)?.state === 'on' })),
    );
  }
  if (klimaatBrug) {
    setInterval(() => {
      klimaatBrug.ronde().then(
        (gedaan) => {
          klopt.gelukt('terug', 'klimaat');
          gedaan.forEach((g) => console.log(`[klimaatbrug] ${g}`));
        },
        (e: unknown) => {
          klopt.meld({ soort: 'terug', id: 'klimaat', naam: 'Een airco of thermostaat', sindsMs: Date.now() });
          console.warn(`[klimaatbrug] terugzetten lukte niet: ${(e as Error).message}`);
        },
      );
      handbediening?.ronde().then(
        (gedaan) => {
          klopt.gelukt('terug', 'hand');
          gedaan.forEach((g) => console.log(`[met de hand] ${g}`));
        },
        (e: unknown) => {
          klopt.meld({ soort: 'terug', id: 'hand', naam: 'Een airco of thermostaat', sindsMs: Date.now() });
          console.warn(`[met de hand] terugzetten lukte niet: ${(e as Error).message}`);
        },
      );
    }, 60_000).unref();
  }
  return { handKnoppen, handSchakelaars, handbediening, kinderslotten, klimaatAan, klimaatBrug, laadBedieningenNu, laadReg, laadhand, losKlimaat, schakelaarKeuzes, schakelaarStore, stekkerZon, stekkerhand, stekkersBekend, stekkersVoorHuis, vindBuffers, vindBuffersHa, vindSchakelaarsNu };
}
