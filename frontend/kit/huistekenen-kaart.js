/*
 * SunArc: je huis tekenen, wat de kaarten vinden en het dak (22 november 2026, opgesplitst uit kit/huistekenen.js).
 *
 * Het afdak van de 3D-kaart, een gebouw op maat, de muren tegen de buren, en het dak met de dakkapellen: de
 * maat van het dak, wat lager is dan 1,5 m, en een dakkapel bewaren.
 *
 * global.htKaart(kern) maakt dit deel voor één tekenaar; `kern` geeft wat de tekenaar deelt (zie maak() in huistekenen.js).
 */
(function (global) {
  'use strict';
  const { CEL, MARGE } = global.htVloer;
  global.htKaart = function (kern) {
      /* ---------- wat de kaarten vinden (ronde 2, 20 november 2026, schets Wand-Huis-Kaarten) */
      const benedenId = () => kern.huis.beneden ?? kern.huis.etages.filter((e) => !e.buiten).at(-1)?.id;
      /** Het afdak voor of achter het hoofdhuis, in meters op het papier; alleen als de 3D-kaart het zag. */
      const afdakVak = () => {
        const b = kern.hoofdBlok();
        const a = b?.afdak;
        if (!a) return null;
        return { a, u0: b.u, u1: b.u + b.b, v0: a.kant === 'voor' ? b.v : b.v + b.d - a.diep, v1: a.kant === 'voor' ? b.v + a.diep : b.v + b.d };
      };
      /** Het label Nieuw staat bij het afdak tot de bewoner het zag (aantikte). */
      const afdakSleutel = (a) => `${a.kant}:${a.diep}`;
      const afdakGezien = () => {
        const a = afdakVak()?.a;
        if (!a) return true;
        try {
          return localStorage.getItem('sc-afdak-gezien') === afdakSleutel(a);
        } catch {
          return false;
        }
      };
      const afdakZie = () => {
        const a = afdakVak()?.a;
        if (!a) return;
        try {
          localStorage.setItem('sc-afdak-gezien', afdakSleutel(a));
        } catch {
          // Zonder opslag staat Nieuw er de volgende keer weer.
        }
      };
      /** Een gebouw op maat: wat de vinger nu trekt, of de maat van de bron. */
      const maatVan = (b) => (b && kern.st.blokMaat?.id === b.id ? { ...b, ...kern.st.blokMaat } : b);
      /** De stippen van een gekozen gebouw bij Vorm: de hoeken, en midden op een muur als die lang genoeg is. */
      const blokGrepen = () => {
        if (kern.st.stand !== 'vorm' || kern.st.kies?.soort !== 'blok' || !kern.opties.gebouw || kern.huis.kijk?.bezig) return [];
        const b = maatVan(kern.bijBlokken().find((q) => q.id === kern.st.kies.id));
        if (!b) return [];
        const [x0, y0, x1, y1] = [kern.X(MARGE + b.u / CEL), kern.Y(MARGE + b.v / CEL), kern.X(MARGE + (b.u + b.b) / CEL), kern.Y(MARGE + (b.v + b.d) / CEL)];
        const uit = [];
        for (const ku of [-1, 0, 1]) {
          for (const kv of [-1, 0, 1]) {
            if ((!ku && !kv) || (!ku && Math.abs(x1 - x0) < 70) || (!kv && Math.abs(y1 - y0) < 70)) continue;
            uit.push({ ku, kv, px: ku < 0 ? x0 : ku > 0 ? x1 : (x0 + x1) / 2, py: kv < 0 ? y0 : kv > 0 ? y1 : (y0 + y1) / 2 });
          }
        }
        return uit;
      };
      /** De nieuwe maat bewaren (na het loslaten meteen, na min en plus even wachten): de pagina bewaart en laadt opnieuw. */
      let maatKlok = null;
      const blokMaatBewaar = (ms) => {
        clearTimeout(maatKlok);
        maatKlok = setTimeout(() => {
          const m = kern.st.blokMaat;
          const h = kern.hoofdBlok();
          if (!m || !h || !kern.opties.gebouw) return;
          kern.st.gebouwBezig = true;
          kern.meld();
          Promise.resolve(kern.opties.gebouw({ maat: m.id, vak: { u: kern.rond(m.u - h.u), v: kern.rond(m.v - h.v), b: m.b, d: m.d } })).finally(() => {
            kern.st.gebouwBezig = false;
            kern.meld();
          });
        }, ms);
      };
      /**
       * De muren van het hoofdhuis tegen de buren (schets Wand-Huis-Woning, 20
       * november 2026), als muurlijnen in rastercellen: links, rechts en achter,
       * van de straat af gezien. Buiten en zonder hoofdhuis: geen.
       */
      const buurMuren = () => {
        // Het hoofdhuis zoals deze etage het heeft: boven het afdak korter (20 november 2026).
        const h = kern.etageVan(kern.st.etage)?.blokken?.find((x) => x.soort === 'hoofdhuis') ?? kern.hoofdBlok();
        const kanten = kern.huis.woning?.soort === 'vrijstaand' ? [] : (kern.huis.woning?.buren ?? []);
        if (!h || !kanten.length || kern.etageVan(kern.st.etage)?.buiten) return [];
        const x0 = MARGE + h.u / CEL;
        const x1 = MARGE + (h.u + h.b) / CEL;
        const y0 = MARGE + h.v / CEL;
        const y1 = MARGE + (h.v + h.d) / CEL;
        return kanten.map((k) => (k === 'links' ? { as: 'x', op: x0, van: y0, tot: y1 } : k === 'rechts' ? { as: 'x', op: x1, van: y0, tot: y1 } : { as: 'y', op: y1, van: x0, tot: x1 }));
      };
      /** Ligt een muur op een muur tegen de buren? Dan komt er geen raam of voordeur. */
      const opBuurMuur = (run) => buurMuren().some((b) => b.as === run.as && Math.abs(b.op - run.op) <= 2 && Math.min(b.tot, run.tot) - Math.max(b.van, run.van) > 3);
      /** De etage onder het dak (de zolder), anders de bovenste. */
      const dakEtage = () => kern.huis.etages.find((e) => e.dak && !e.buiten)?.id ?? kern.huis.etages.find((e) => !e.buiten)?.id ?? null;
      /** De dakkapellen van het blok als die van de bewoner: kant, van..tot langs de nok, diep vanaf de goot, en de etage. */
      const kapelsVan = (b) => (b?.dakkapellen ?? []).map((k) => ({ kant: k.kant, van: k.van, tot: k.tot, diep: Math.max(0.5, Math.round((k.achter - k.voor) * 10) / 10), etage: k.etage ?? null }));
      kern.st.kapellen = kapelsVan(kern.hoofdBlok());
      /**
       * Het dak van het hoofdhuis in meters: `a` loopt langs de nok, `c` er
       * dwars op (kant 0 is de kant met de kleinste c: voor of links). Met de
       * goot van elke kant, de nok en hoe ver de nok van elke goot ligt. Null bij
       * een plat dak.
       */
      const dakMaat = () => {
        const b = kern.hoofdBlok();
        if (!b || !b.dak || b.dak === 'plat') return null;
        const langs = b.nokLangs === 'y';
        const [a0, la, c0, lc] = langs ? [b.v, b.d, b.u, b.b] : [b.u, b.b, b.v, b.d];
        const naar0 = b.nokVan0 ?? lc / 2;
        return { b, langs, a0, la, c0, lc, naar: [naar0, lc - naar0], goot: [b.goot0 ?? b.goot1 ?? 3, b.goot1 ?? b.goot0 ?? 3], nok: b.nok ?? 8 };
      };
      /** Hoe hoog de vloer van een etage ligt: de etages eronder bij elkaar. */
      const vloerHoogte = (id) => {
        const lijst = kern.huis.etages.filter((e) => !e.buiten);
        const i = lijst.findIndex((e) => e.id === id);
        return i < 0 ? 0 : lijst.slice(i + 1).reduce((t, e) => t + (e.hoogte ?? 2.6), 0);
      };
      /** Per kant hoe ver vanaf de goot het dak lager is dan 1,5 m boven de vloer van deze etage. */
      const laagStrook = (id) => {
        const m = dakMaat();
        if (!m) return [0, 0];
        const z = vloerHoogte(id) + 1.5;
        return [0, 1].map((k) => {
          const helling = (m.nok - m.goot[k]) / Math.max(0.1, m.naar[k]);
          return helling <= 0 ? 0 : Math.max(0, Math.min(m.naar[k], (z - m.goot[k]) / helling));
        });
      };
      /** De etages waar een dakkapel op kan: onder het schuine dak (een strook van minstens 20 cm). */
      const kapelEtages = () => (dakMaat() ? kern.huis.etages.filter((e) => !e.buiten && (e.id === dakEtage() || Math.max(...laagStrook(e.id)) >= 0.2)).map((e) => e.id) : []);
      /** Waar een dakkapel ligt, in meters op het papier. */
      const kapelRecht = (k, m) => {
        const a = [m.a0 + k.van, m.a0 + k.tot];
        const c = k.kant === 0 ? [m.c0 + 0.3, m.c0 + 0.3 + k.diep] : [m.c0 + m.lc - 0.3 - k.diep, m.c0 + m.lc - 0.3];
        return m.langs ? { u0: c[0], u1: c[1], v0: a[0], v1: a[1] } : { u0: a[0], u1: a[1], v0: c[0], v1: c[1] };
      };
      const opDezeEtage = () => kern.st.kapellen.map((k, i) => ({ k, i })).filter(({ k }) => (k.etage ?? dakEtage()) === kern.st.etage);
      /** Na elke verandering: het blok (voor Huis in 3D) en de dienst. */
      const kapelBewaar = () => {
        const b = kern.hoofdBlok();
        if (b) {
          b.dakkapellen = kern.st.kapellen.map((k) => ({ kant: k.kant, van: k.van, tot: k.tot, voor: 0.3, achter: Math.round((0.3 + k.diep) * 10) / 10, ...(k.etage ? { etage: k.etage } : {}) }));
          b.kapelBron = 'bewoner';
          delete b.kapelVraag;
        }
        kern.opties.kapel?.(kern.st.kapellen.map((k) => ({ kant: k.kant, van: k.van, tot: k.tot, diep: k.diep, ...(k.etage ? { etage: k.etage } : {}) })));
      };

    return { benedenId, afdakVak, afdakGezien, afdakZie, maatVan, blokGrepen, blokMaatBewaar, buurMuren, opBuurMuur, dakEtage, dakMaat, vloerHoogte, laagStrook, kapelEtages, kapelRecht, opDezeEtage, kapelBewaar };
  };
})(typeof window !== 'undefined' ? window : globalThis);
