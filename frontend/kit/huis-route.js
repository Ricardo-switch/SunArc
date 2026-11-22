/*
 * SunArc: het poppenhuis, de weg van de stroom (22 november 2026, opgesplitst uit kit/huis.js).
 *
 * Van waar naar waar een stroomlijn loopt: van de panelen, het net, de thuisaccu en de auto naar het huis en terug.
 *
 * global.huisRoute(kern) maakt dit deel voor één tekenaar; `kern` geeft wat de tekenaar deelt (zie maak() in huistekenen.js).
 */
(function (global) {
  'use strict';

  global.huisRoute = function (kern) {
      function route(van, naar) {
        const pts = [];
        const accuY = kern.accuPlek.y + 0.3;
        /**
         * Een thuisaccu binnen (besluit 273): van de kast tegen de achterwand over
         * de vloer naar de voorgevel, en langs de gevel naar beneden.
         */
        const accuBinnen = !kern.model.batterij && kern.plek.thuisaccu
          ? () => {
              const [tx, , tz] = kern.plek.thuisaccu;
              const vloer = Math.max(0.03, tz - 0.62);
              return [[tx, 0.2, vloer + 0.02], [tx, kern.D + 0.02, vloer + 0.02], ...(vloer > 0.1 ? [[tx, kern.D + 0.02, 0.03]] : [])];
            }
          : null;
        /** In de wereld (huis 3.0): van de straat onder de grond, in de doorsnede, naar de meterkast. */
        const ondergronds = () => {
          const mkp = kern.voordeur ? kern.plek.meterkast : null;
          const xm = mkp ? mkp[0] : kern.W * 0.3;
          const y = kern.eiland.yF + 0.003;
          const uit = [[kern.netStraat[0], kern.netStraat[1], 0.2], [kern.netStraat[0], y, 0.02], [kern.netStraat[0], y, -0.32], [kern.eiland.nis ? -0.12 : xm, y, -0.32]];
          if (kern.eiland.nis) uit.push([-0.12, y, -0.05], [-0.12, kern.D + 0.3, 0.02], [xm, kern.D + 0.3, 0.02]);
          else uit.push([xm, y, 0.02], [xm, kern.D + 0.1, 0.02]);
          if (mkp) uit.push([mkp[0], mkp[1], 0.02], [mkp[0], mkp[1], 0.2]);
          return uit;
        };
        const kamerPunt = (wie) => {
          const k2 = kern.vindKamer(wie);
          return k2 ? [k2.xm, kern.D + 0.02, k2.z0 + 0.03] : [kern.W * 0.5, kern.D + 0.02, 0.03];
        };
        /*
         * Met een voordeur komt het net via de voortuin het huis in, in de
         * meterkast in de hal, en gaat het van daar naar de woonkamer (de
         * bewoner, 16 oktober). Niet meer om de voortuin heen naar de hoek.
         */
        const mk = kern.voordeur ? kern.plek.meterkast : null;
        const voorlangs = kern.D + 0.14;
        // Liggen de panelen alleen op de garage (huis 3.0), dan komt de zon van daar.
        if ((van === 'zon' && kern.nGarage > 0 && kern.nHuis === 0) || van === 'zonGarage') pts.push([-1.6, -1.25, 1.15], [-1.12, -1.25, 1.15], [-1.12, -1.25, 0.02], [-1.12, kern.D + 0.35, 0.02], kern.hub);
        else if (van === 'zon') pts.push(kern.voetPaneel, [kern.W + 0.12, kern.D + 0.02, kern.zt - 0.05], [kern.W + 0.12, kern.D + 0.02, 0.05], kern.hub);
        else if (van === 'batterij' && accuBinnen) pts.push(...accuBinnen(), [kern.W + 0.02, kern.D + 0.02, 0.03], kern.hub);
        else if (van === 'batterij') pts.push([kern.accuPlek.x + 0.18, accuY, 0.4], [kern.accuPlek.x + 0.18, accuY, 0.02], ...(kern.accuPlek.x < 0 ? [[kern.accuPlek.x + 0.18, kern.D + 0.35, 0.02]] : []), kern.hub);
        // In de wereld (huis 3.0) loopt de kabel zichtbaar onder de grond, in de doorsnede.
        else if (van === 'net' && kern.eiland) pts.push(...ondergronds());
        else if (van === 'net' && mk) pts.push([kern.netStraat[0], kern.netStraat[1], 0.02], [kern.netStraat[0], voorlangs, 0.02], [mk[0], voorlangs, 0.02], [mk[0], mk[1], 0.02], [mk[0], mk[1], 0.2]);
        else if (van === 'net') pts.push([kern.netStraat[0], kern.netStraat[1], 0.02], [kern.netStraat[0], kern.D + 0.6, 0.02], [kern.W + 0.25, kern.D + 0.6, 0.02], kern.hub);
        else if (van === 'auto') pts.push([-0.95, kern.D + 0.1, 0.4], [-0.95, kern.D + 0.35, 0.02], kern.hub);
        if (van === 'net' && mk && (naar === 'huis' || naar?.startsWith('kamer:'))) {
          // Van de meterkast door de hal naar de woonkamer, of naar de gevraagde kamer.
          const doel = naar === 'huis'
            ? kern.kamers.find((x) => x.z0 < 0.1 && (x.soort === 'woonkamer' || x.soort === 'woonkeuken'))
            : kern.vindKamer(naar.slice(6));
          const x = doel?.xm ?? kern.W * 0.55;
          pts.push([mk[0] + 0.12, mk[1], 0.03], [x, mk[1], 0.03]);
          if (doel && doel.z0 > 0.1) pts.push([x, kern.D + 0.02, 0.03], [x, kern.D + 0.02, doel.z0 + 0.03]);
          return pts;
        }
        if (naar === 'batterij' && accuBinnen) pts.push([kern.W + 0.02, kern.D + 0.02, 0.03], ...accuBinnen().reverse());
        else if (naar === 'batterij') pts.push(...(kern.accuPlek.x < 0 ? [[kern.accuPlek.x + 0.18, kern.D + 0.35, 0.02]] : []), [kern.accuPlek.x + 0.18, accuY, 0.02], [kern.accuPlek.x + 0.18, accuY, 0.4]);
        else if (naar === 'auto') pts.push([kern.W + 0.25, kern.D + 0.35, 0.02], [-0.95, kern.D + 0.35, 0.02], [-0.95, kern.D + 0.1, 0.4]);
        // Terug naar het net: dezelfde weg andersom, door het huis naar de meterkast en via de voortuin naar de straat.
        else if (naar === 'net' && kern.eiland) pts.push([kern.W - 0.05, kern.D + 0.3, 0.03], ...ondergronds().reverse());
        else if (naar === 'net' && mk) pts.push([kern.W - 0.05, mk[1], 0.03], [mk[0] + 0.12, mk[1], 0.03], [mk[0], mk[1], 0.02], [mk[0], voorlangs, 0.02], [kern.netStraat[0], voorlangs, 0.02], [kern.netStraat[0], kern.netStraat[1], 0.02]);
        else if (naar === 'net') pts.push([kern.W + 0.25, kern.D + 0.6, 0.02], [kern.netStraat[0], kern.D + 0.6, 0.02], [kern.netStraat[0], kern.netStraat[1], 0.02]);
        else if (naar?.startsWith('kamer:')) {
          const kp = kamerPunt(naar.slice(6));
          pts.push([kern.W + 0.02, kern.D + 0.02, 0.03], [kp[0], kern.D + 0.02, 0.03]);
          if (kp[2] > 0.1) pts.push([kp[0], kern.D + 0.02, kp[2]]);
        } else if (naar === 'huis') pts.push([kern.W + 0.02, kern.D + 0.02, 0.03], [kern.W * 0.55, kern.D + 0.02, 0.03]);
        return pts.length > 1 ? pts : null;
      }

    return { route };
  };
})(window);
