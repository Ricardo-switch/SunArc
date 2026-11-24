/*
 * De iconen van SunArc (schets Wand-Iconen): één set voor de
 * hele app, in plaats van een lijstje per pagina. Duotoon: een fijne lijn
 * (1,6) met een zacht vlak in de kleur van het onderwerp. Het actieve
 * menu-item krijgt het vlak voluit (kit.css, `.ik-vlak`).
 *
 * Tekenregels: raster van 24, 2 rand vrij, ronde uiteinden en hoeken,
 * hoekstraal 2,5 tot 3. Per icoon `l` de lijn, `v` het vlak (een deel van de
 * vorm, of leeg) en `k` de kleur.
 *
 * Gebruik: `iconen.svg('licht')`, of met opties `{ grootte, klasse, label,
 * zonderVlak }`. Oude namen uit de pagina's staan als alias in ALIAS.
 */
(function (global) {
  'use strict';

  /** De kleuren van de onderwerpen, dezelfde als de tokens in kit.css. */
  const K = { zon: '#f7b548', ijs: '#6fd3ff', mint: '#6ee7b7', violet: '#8f86ff', gloed: '#ff7a4d', net: '#c9d3dc' };

  const I = {
    /* ---- het menu ---- */
    thuis: { k: 'mint', l: '<path d="M3.5 10.6 12 4l8.5 6.6"/><path d="M5.5 9.1V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.1"/><path d="M10 20v-4.5a2 2 0 0 1 4 0V20"/>', v: '<path d="M5.5 9.1 12 4l6.5 5.1V20h-13z"/>' },
    vandaag: { k: 'zon', l: '<path d="M3 18.5h18"/><path d="M6.8 18.5a5.2 5.2 0 0 1 10.4 0"/><path d="M12 6.2v2.4M5.4 9.6l1.7 1.7M18.6 9.6l-1.7 1.7M2.8 14.6h2.3M18.9 14.6h2.3"/>', v: '<path d="M6.8 18.5a5.2 5.2 0 0 1 10.4 0z"/>' },
    tedoen: { k: 'mint', l: '<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="m8 9.2 1.4 1.4 2.6-2.6M8 15.2l1.4 1.4 2.6-2.6M14.6 9.6h1.9M14.6 15.6h1.9"/>', v: '<rect x="4" y="3.5" width="16" height="17" rx="3"/>' },
    apparaten: { k: 'zon', l: '<path d="M13.2 3 6 13.2h5.3L10.7 21 18 10.8h-5.3z"/>', v: '<path d="M13.2 3 6 13.2h5.3L10.7 21 18 10.8h-5.3z"/>' },
    opbrengst: { k: 'zon', l: '<rect x="4" y="12" width="4" height="8" rx="1.6"/><rect x="10" y="7.5" width="4" height="12.5" rx="1.6"/><rect x="16" y="4" width="4" height="16" rx="1.6"/>', v: '<rect x="16" y="4" width="4" height="16" rx="1.6"/>' },
    assistent: { k: 'violet', l: '<path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.6L4.2 20l1.2-3.6A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/><path d="m12 8.3.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>', v: '<path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.6L4.2 20l1.2-3.6A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/>' },
    meldingen: { k: 'gloed', l: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.4 1.5H5.1z"/><path d="M10.2 20.6h3.6"/>', v: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.4 1.5H5.1z"/>' },
    // Een rond tandwiel met acht gelijke tanden (eerst was hij hoekig en scheef).
    instellingen: { k: 'net', l: '<circle cx="12" cy="12" r="2.8"/><path d="M10.41 4.77L10.65 2.5L13.35 2.5L13.59 4.77A7.4 7.4 0 0 1 15.99 5.77L17.76 4.32L19.68 6.24L18.23 8.01A7.4 7.4 0 0 1 19.23 10.41L21.5 10.65L21.5 13.35L19.23 13.59A7.4 7.4 0 0 1 18.23 15.99L19.68 17.76L17.76 19.68L15.99 18.23A7.4 7.4 0 0 1 13.59 19.23L13.35 21.5L10.65 21.5L10.41 19.23A7.4 7.4 0 0 1 8.01 18.23L6.24 19.68L4.32 17.76L5.77 15.99A7.4 7.4 0 0 1 4.77 13.59L2.5 13.35L2.5 10.65L4.77 10.41A7.4 7.4 0 0 1 5.77 8.01L4.32 6.24L6.24 4.32L8.01 5.77A7.4 7.4 0 0 1 10.41 4.77Z"/>', v: '<path d="M10.41 4.77L10.65 2.5L13.35 2.5L13.59 4.77A7.4 7.4 0 0 1 15.99 5.77L17.76 4.32L19.68 6.24L18.23 8.01A7.4 7.4 0 0 1 19.23 10.41L21.5 10.65L21.5 13.35L19.23 13.59A7.4 7.4 0 0 1 18.23 15.99L19.68 17.76L17.76 19.68L15.99 18.23A7.4 7.4 0 0 1 13.59 19.23L13.35 21.5L10.65 21.5L10.41 19.23A7.4 7.4 0 0 1 8.01 18.23L6.24 19.68L4.32 17.76L5.77 15.99A7.4 7.4 0 0 1 4.77 13.59L2.5 13.35L2.5 10.65L4.77 10.41A7.4 7.4 0 0 1 5.77 8.01L4.32 6.24L6.24 4.32L8.01 5.77A7.4 7.4 0 0 1 10.41 4.77Z"/>' },

    /* ---- klimaat ---- */
    klimaat: { k: 'gloed', l: '<path d="M10 14.2V5.6a2 2 0 0 1 4 0v8.6a4 4 0 1 1-4 0z"/><path d="M12 9.5v6.3"/>', v: '<circle cx="12" cy="17.4" r="3.2"/>' },
    airco: { k: 'ijs', l: '<rect x="3" y="4.5" width="18" height="7.5" rx="2.6"/><path d="M7 9h10"/><path d="M8 15.2c0 1.5-1 2.1-1 3.6M12 15.2v3.9M16 15.2c0 1.5 1 2.1 1 3.6"/>', v: '<rect x="3" y="4.5" width="18" height="7.5" rx="2.6"/>' },
    thermostaat: { k: 'gloed', l: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><path d="M12 7.4v2.2"/>', v: '<circle cx="12" cy="12" r="4.6"/>' },
    verwarming: { k: 'gloed', l: '<rect x="3.5" y="6" width="17" height="12" rx="2.6"/><path d="M7.5 6v12M12 6v12M16.5 6v12"/><path d="M6 18v2M18 18v2"/>', v: '<rect x="3.5" y="6" width="17" height="12" rx="2.6"/>' },
    warm: { k: 'gloed', l: '<path d="M12 21a6 6 0 0 0 6-6c0-3.6-2.6-5.6-4-9-1 2.2-1.4 3.5-3.4 5.2C9.2 9.8 9 8.5 9 7.2 7 9 6 11.6 6 15a6 6 0 0 0 6 6z"/>', v: '<path d="M12 21a6 6 0 0 0 6-6c0-3.6-2.6-5.6-4-9-1 2.2-1.4 3.5-3.4 5.2C9.2 9.8 9 8.5 9 7.2 7 9 6 11.6 6 15a6 6 0 0 0 6 6z"/>' },
    koel: { k: 'ijs', l: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2M4.6 10.4l3.2.6.9-3.1M19.4 13.6l-3.2-.6-.9 3.1M4.6 13.6l3.2-.6.9 3.1M19.4 10.4l-3.2.6-.9-3.1"/>', v: '' },
    comfort: { k: 'mint', l: '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>', v: '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>' },
    gevoel: { k: 'mint', l: '<circle cx="12" cy="12" r="8.5"/><path d="M8.6 14.2a4.2 4.2 0 0 0 6.8 0"/><path d="M9.2 9.6v.6M14.8 9.6v.6"/>', v: '<circle cx="12" cy="12" r="8.5"/>' },
    vocht: { k: 'ijs', l: '<path d="M12 3.5s-6 6.4-6 10.6a6 6 0 0 0 12 0C18 9.9 12 3.5 12 3.5z"/>', v: '<path d="M12 3.5s-6 6.4-6 10.6a6 6 0 0 0 12 0C18 9.9 12 3.5 12 3.5z"/>' },
    filter: { k: 'ijs', l: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 4v16M12 4v16M16 4v16"/>', v: '<rect x="4" y="4" width="16" height="16" rx="3"/>' },
    ventilatie: { k: 'ijs', l: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10.2C11 6.5 12.6 4 15 4c1.5 0 2.4 1 2.4 2.2 0 2.4-3.5 3.5-5.4 4M13.8 12c3.7-1 6.2.6 6.2 3 0 1.5-1 2.4-2.2 2.4-2.4 0-3.5-3.5-4-5.4M12 13.8c1 3.7-.6 6.2-3 6.2-1.5 0-2.4-1-2.4-2.2 0-2.4 3.5-3.5 5.4-4M10.2 12C6.5 13 4 11.4 4 9c0-1.5 1-2.4 2.2-2.4 2.4 0 3.5 3.5 4 5.4"/>', v: '<circle cx="12" cy="12" r="8"/>' },

    /* ---- zon en energie ---- */
    zon: { k: 'zon', l: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/>', v: '<circle cx="12" cy="12" r="4.2"/>' },
    panelen: { k: 'zon', l: '<path d="M5.3 5h13.4l2.1 9.8H3.2z"/><path d="M4.2 9.9h15.6M9.7 5l-.6 9.8M14.3 5l.6 9.8"/><path d="M12 14.8v3.7M8.5 19.5h7"/>', v: '<path d="M5.3 5h13.4l2.1 9.8H3.2z"/>' },
    batterij: { k: 'mint', l: '<rect x="3" y="7" width="16" height="10" rx="2.6"/><path d="M21 10.4v3.2"/><path d="m11.6 9.2-2.1 3.1h3l-2.1 2.9"/>', v: '<rect x="3" y="7" width="16" height="10" rx="2.6"/>' },
    accu: { k: 'mint', l: '<rect x="6" y="5" width="12" height="16" rx="2.6"/><path d="M10 2.8h4"/><path d="m12.8 9.4-2.3 3.4h3l-2.3 3.2"/>', v: '<rect x="6" y="5" width="12" height="16" rx="2.6"/>' },
    meter: { k: 'zon', l: '<path d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0"/><path d="m12 15 3.6-4.6"/><circle cx="12" cy="15.2" r="1.3"/>', v: '<path d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0z"/>' },
    // Meld een probleem (testerronde, november 2026): een tekstballon met een uitroepteken.
    melden: { k: 'gloed', l: '<path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.6L4.2 20l1.2-3.6A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/><path d="M12 8.2v3.8M12 14.6v.1"/>', v: '<path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.6L4.2 20l1.2-3.6A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/>' },
    // Steunen: een kop koffie, bij Over deze app en Versie.
    koffie: { k: 'zon', l: '<path d="M4.5 10h12v4.3a5.2 5.2 0 0 1-5.2 5.2h-1.6a5.2 5.2 0 0 1-5.2-5.2z"/><path d="M16.5 11.4h1.3a2.3 2.3 0 0 1 0 4.6h-1.7"/><path d="M8.6 3.6c-.9 1.1.9 1.9 0 3M12.4 3.6c-.9 1.1.9 1.9 0 3"/>', v: '<path d="M4.5 10h12v4.3a5.2 5.2 0 0 1-5.2 5.2h-1.6a5.2 5.2 0 0 1-5.2-5.2z"/>' },
    stekker: { k: 'zon', l: '<path d="M9 3.5v4M15 3.5v4"/><path d="M6.5 7.5h11V11a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.5v4"/>', v: '<path d="M6.5 7.5h11V11a5.5 5.5 0 0 1-11 0z"/>' },
    aansluiting: { k: 'zon', l: '<rect x="5" y="3" width="14" height="18" rx="3"/><circle cx="12" cy="10" r="3.2"/><path d="m12.6 9-1.3 1.7h1.6l-1.3 1.6"/><path d="M8.5 16.5h7"/>', v: '<circle cx="12" cy="10" r="3.2"/>' },
    prijzen: { k: 'zon', l: '<path d="M17.5 6.2A7 7 0 1 0 17.5 17.8"/><path d="M4.5 10h9M4.5 14h9"/>', v: '' },
    opzon: { k: 'zon', l: '<circle cx="9" cy="9" r="3.4"/><path d="M9 2.8v1.4M2.8 9h1.4M4.6 4.6l1 1M13.4 4.6l-1 1"/><path d="M14 12.5h6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5A1.5 1.5 0 0 1 14 19z"/><path d="M15.8 12.5v-2M18.7 12.5v-2"/>', v: '<circle cx="9" cy="9" r="3.4"/>' },
    laadpaal: { k: 'mint', l: '<rect x="5" y="3" width="10" height="18" rx="2.6"/><path d="M8 7.5h4"/><path d="m10.8 11-1.6 2.3h2l-1.6 2.2"/><path d="M15 9.5h1.8a1.7 1.7 0 0 1 1.7 1.7v5a1.5 1.5 0 0 0 3 0V9l-2-2"/>', v: '<rect x="5" y="3" width="10" height="18" rx="2.6"/>' },
    sluip: { k: 'zon', l: '<path d="M12 3.5v7"/><path d="M7.2 6.4a7.2 7.2 0 1 0 9.6 0"/>', v: '' },
    grafiek: { k: 'zon', l: '<path d="M3.5 19.5h17"/><path d="m5 15 4.2-4.6 3.4 3 6.4-7.4"/><path d="M15.5 6h3.5v3.5"/>', v: '' },
    voorrang: { k: 'zon', l: '<path d="M8 20V5M4.5 8.5 8 5l3.5 3.5"/><path d="M16 4v15M12.5 15.5 16 19l3.5-3.5"/>', v: '' },

    /* ---- apparaten ---- */
    licht: { k: 'zon', l: '<path d="M9.4 17.6h5.2M10.3 20.8h3.4"/><path d="M12 3.2a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v.2h5.2V16c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.2z"/>', v: '<path d="M12 3.2a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v.2h5.2V16c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.2z"/>' },
    scene: { k: 'violet', l: '<path d="M10 3.5 11.4 8l4.6 1.5-4.6 1.4L10 15.5l-1.4-4.6L4 9.5 8.6 8z"/><path d="m17.5 13 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>', v: '<path d="M10 3.5 11.4 8l4.6 1.5-4.6 1.4L10 15.5l-1.4-4.6L4 9.5 8.6 8z"/>' },
    screen: { k: 'ijs', l: '<path d="M3.8 4h16.4"/><path d="M5.6 4v9.6h12.8V4"/><path d="M5.6 7.2h12.8M5.6 10.4h12.8"/><path d="M12 13.6v4"/><circle cx="12" cy="19.2" r="1.3"/>', v: '<path d="M5.6 4h12.8v9.6H5.6z"/>' },
    zonnescherm: { k: 'zon', l: '<path d="M3.5 5h17"/><path d="M4.5 5 3 11h18l-1.5-6"/><path d="M3 11c0 1.4 1 2.4 2.2 2.4S7.5 12.4 7.5 11c0 1.4 1 2.4 2.2 2.4s2.3-1 2.3-2.4c0 1.4 1 2.4 2.2 2.4s2.3-1 2.3-2.4c0 1.4 1 2.4 2.2 2.4S21 12.4 21 11"/>', v: '<path d="M4.5 5 3 11h18l-1.5-6z"/>' },
    witgoed: { k: 'ijs', l: '<rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="13.2" r="4.6"/><path d="M7.4 6.6h2M14.4 6.6h2.2"/><path d="M9.6 13.7c1.5-1 3.3 1 4.8 0"/>', v: '<circle cx="12" cy="13.2" r="4.6"/>' },
    droger: { k: 'ijs', l: '<rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="13.2" r="4.6"/><path d="M7.4 6.6h2"/><path d="M11 11.5c-.6.7-.6 1.5 0 2.2s.6 1.5 0 2.2M13.4 10.5c-.6.7-.6 1.5 0 2.2s.6 1.5 0 2.2"/>', v: '<circle cx="12" cy="13.2" r="4.6"/>' },
    vaat: { k: 'ijs', l: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M4 8h16"/><path d="M7.4 5.6h2"/><path d="M8 11.5v6M11 11.5v6M14 11.5v6"/><path d="M16.5 12a1.5 1.5 0 0 1 0 3"/>', v: '<path d="M4 8h16v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/>' },
    boiler: { k: 'gloed', l: '<rect x="7" y="2.8" width="10" height="18.4" rx="5"/><path d="M10 16.2h4"/><path d="M12 7.6c-1 1.2-1.6 2-1.6 2.9a1.6 1.6 0 0 0 3.2 0c0-.9-.6-1.7-1.6-2.9z"/>', v: '<rect x="7" y="2.8" width="10" height="18.4" rx="5"/>' },
    jacuzzi: { k: 'ijs', l: '<path d="M3 12.5h18v1.6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M8 8.8c0-1.4 1-1.8 1-3.2M12 8.8c0-1.4 1-1.8 1-3.2M16 8.8c0-1.4 1-1.8 1-3.2"/>', v: '<path d="M3 12.5h18v1.6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/>' },
    apparaat: { k: 'zon', l: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v4.2"/><path d="M9 9.3a4 4 0 1 0 6 0"/>', v: '<rect x="4" y="4" width="16" height="16" rx="4"/>' },
    camera: { k: 'violet', l: '<rect x="3" y="6.5" width="12.6" height="11" rx="3"/><path d="m15.6 10.4 5-2.9v9l-5-2.9"/>', v: '<rect x="3" y="6.5" width="12.6" height="11" rx="3"/>' },
    deurbel: { k: 'violet', l: '<rect x="7" y="2.8" width="10" height="18.4" rx="5"/><circle cx="12" cy="14.6" r="2.3"/><path d="M10.5 7.6h3"/>', v: '<circle cx="12" cy="14.6" r="2.3"/>' },
    rook: { k: 'gloed', l: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 5.8v.4M16.4 7.6l-.3.3M18.2 12h-.4"/>', v: '<circle cx="12" cy="12" r="3"/>' },
    beweging: { k: 'violet', l: '<circle cx="13.5" cy="4.6" r="1.8"/><path d="m9 21 2.6-6.3 2.4 2.3V21"/><path d="M6.5 11.2 9.6 8.5h4l2.4 3.2 2.5.8"/><path d="m11.6 8.5-.4 6"/>', v: '' },
    auto: { k: 'net', l: '<path d="M5 16.4V12l1.8-4.1a2 2 0 0 1 1.8-1.3h6.8a2 2 0 0 1 1.8 1.3L19 12v4.4"/><path d="M4 12.4h16v4.2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M6.4 17.6v1.6M17.6 17.6v1.6"/><circle cx="7.8" cy="15" r=".5"/><circle cx="16.2" cy="15" r=".5"/>', v: '<path d="M4 12.4h16v4.2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>' },
    wand: { k: 'mint', l: '<rect x="3" y="4.5" width="18" height="12.6" rx="2.6"/><path d="M9 20.6h6M12 17.1v3.5"/>', v: '<rect x="3" y="4.5" width="18" height="12.6" rx="2.6"/>' },
    telefoon: { k: 'mint', l: '<rect x="6.5" y="2.8" width="11" height="18.4" rx="3"/><path d="M10.8 18.2h2.4"/>', v: '<rect x="6.5" y="2.8" width="11" height="18.4" rx="3"/>' },
    tablet: { k: 'mint', l: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10.8 18h2.4"/>', v: '<rect x="4" y="3" width="16" height="18" rx="3"/>' },

    /* ---- kamers en het huis ---- */
    slaapkamer: { k: 'violet', l: '<path d="M3 18.6v-7.4a2.1 2.1 0 0 1 2.1-2.1h13.8a2.1 2.1 0 0 1 2.1 2.1v7.4"/><path d="M3 15.2h18"/><path d="M6 9.1V6.6A1.6 1.6 0 0 1 7.6 5h8.8A1.6 1.6 0 0 1 18 6.6v2.5"/>', v: '<path d="M3 15.2v-4a2.1 2.1 0 0 1 2.1-2.1h13.8a2.1 2.1 0 0 1 2.1 2.1v4z"/>' },
    kinderkamer: { k: 'violet', l: '<circle cx="12" cy="13.5" r="5.5"/><circle cx="7.6" cy="7.4" r="2.2"/><circle cx="16.4" cy="7.4" r="2.2"/><path d="M10.2 14.6a2.3 2.3 0 0 0 3.6 0M10 12v.3M14 12v.3"/>', v: '<circle cx="12" cy="13.5" r="5.5"/>' },
    woonkamer: { k: 'mint', l: '<path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M5.5 18.5v1.5M18.5 18.5v1.5"/>', v: '<path d="M7 15h10v-2a2 2 0 0 1 2-2V8.5A2.5 2.5 0 0 0 16.5 6h-9A2.5 2.5 0 0 0 5 8.5V11a2 2 0 0 1 2 2z"/>' },
    keuken: { k: 'gloed', l: '<path d="M3.2 11.2h13.6v2.3a5 5 0 0 1-5 5H8.2a5 5 0 0 1-5-5z"/><path d="M16.8 12.4h4"/><path d="M8 4.6c0 1.5 1 1.5 1 3M12 4.6c0 1.5 1 1.5 1 3"/>', v: '<path d="M3.2 11.2h13.6v2.3a5 5 0 0 1-5 5H8.2a5 5 0 0 1-5-5z"/>' },
    eetkamer: { k: 'gloed', l: '<path d="M3.5 10h17"/><path d="M5.5 10v9.5M18.5 10v9.5"/><path d="M8 6.2c1.2-1.6 2.4-2.2 4-2.2s2.8.6 4 2.2"/><path d="M5.5 14.5h13"/>', v: '<rect x="3.5" y="10" width="17" height="4.5" rx="1"/>' },
    badkamer: { k: 'ijs', l: '<path d="M3 12h18v2.1a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M6 12V6.6a2.6 2.6 0 0 1 4.6-1.6"/><path d="m7 19.1-1 1.8M17 19.1l1 1.8"/>', v: '<path d="M3 12h18v2.1a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/>' },
    toilet: { k: 'ijs', l: '<path d="M7 3.5h6a1 1 0 0 1 1 1V10H6V4.5a1 1 0 0 1 1-1z"/><path d="M4.5 10h15a6.5 6.5 0 0 1-6.5 6.5h-2A6.5 6.5 0 0 1 4.5 10z"/><path d="m9 16.3-.6 4.2h7.2l-.6-4.2"/>', v: '<path d="M4.5 10h15a6.5 6.5 0 0 1-6.5 6.5h-2A6.5 6.5 0 0 1 4.5 10z"/>' },
    hal: { k: 'net', l: '<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21"/><path d="M3.5 21h17"/><circle cx="14.6" cy="12.5" r=".9"/>', v: '<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21z"/>' },
    werkkamer: { k: 'violet', l: '<rect x="4" y="4.5" width="16" height="10.5" rx="2.2"/><path d="M2.5 19h19"/><path d="M8 15l-.8 4M16 15l.8 4"/>', v: '<rect x="4" y="4.5" width="16" height="10.5" rx="2.2"/>' },
    berging: { k: 'net', l: '<path d="M4 8.2 12 4l8 4.2v9.6L12 22l-8-4.2z"/><path d="M4 8.2 12 12.5l8-4.3M12 12.5V22"/>', v: '<path d="M4 8.2 12 12.5V22l-8-4.2z"/>' },
    kelder: { k: 'net', l: '<path d="M3.5 6h4v4h4v4h4v4h5"/><path d="M3.5 6v14.5h17V18"/>', v: '<path d="M3.5 6h4v4h4v4h4v4h5v2.5h-17z"/>' },
    trap: { k: 'net', l: '<path d="M3.5 20.5h4.5v-4h4v-4h4v-4h4.5"/><path d="M15 3.5h5.5V9"/>', v: '' },
    garage: { k: 'net', l: '<path d="M3 10 12 4.5 21 10v10.5H3z"/><path d="M6.5 20.5v-8h11v8"/><path d="M6.5 15.2h11M6.5 17.9h11"/>', v: '<path d="M6.5 12.5h11v8h-11z"/>' },
    carport: { k: 'net', l: '<path d="M3 7.5 12 4l9 3.5"/><path d="M5 7v13.5M19 7v13.5"/><path d="M7.5 18v-3l1-2.5h7l1 2.5v3z"/>', v: '<path d="M7.5 18v-3l1-2.5h7l1 2.5v3z"/>' },
    oprit: { k: 'net', l: '<path d="M8 3.5 5 20.5M16 3.5l3 17"/><path d="M12 5v2.2M12 10.4v2.2M12 15.8V18"/>', v: '<path d="M8 3.5h8l3 17H5z"/>' },
    tuin: { k: 'mint', l: '<path d="M12 21v-7.5"/><path d="M12 13.5c-3.6 0-6.5-2.5-6.5-5.7S8.4 3 12 3s6.5 1.6 6.5 4.8-2.9 5.7-6.5 5.7z"/><path d="M9 21h6"/>', v: '<path d="M12 13.5c-3.6 0-6.5-2.5-6.5-5.7S8.4 3 12 3s6.5 1.6 6.5 4.8-2.9 5.7-6.5 5.7z"/>' },
    border: { k: 'mint', l: '<path d="M3.5 20.5h17"/><path d="M7 20.5v-5M12 20.5v-7M17 20.5v-5"/><circle cx="7" cy="13" r="2.5"/><circle cx="12" cy="10.5" r="2.5"/><circle cx="17" cy="13" r="2.5"/>', v: '<circle cx="12" cy="10.5" r="2.5"/>' },
    buiten: { k: 'mint', l: '<path d="M7 20v-4.5"/><path d="M7 15.5a3.5 3.5 0 0 1-3.5-3.5c0-2.5 2-6 3.5-8 1.5 2 3.5 5.5 3.5 8A3.5 3.5 0 0 1 7 15.5z"/><path d="M16.5 20v-6"/><path d="M16.5 14a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M3 20.5h18"/>', v: '<path d="M7 15.5a3.5 3.5 0 0 1-3.5-3.5c0-2.5 2-6 3.5-8 1.5 2 3.5 5.5 3.5 8A3.5 3.5 0 0 1 7 15.5z"/>' },
    tuinhuis: { k: 'mint', l: '<path d="M3.5 10 12 4.5l8.5 5.5"/><path d="M5.5 9v11.5h13V9"/><path d="M10 20.5V15h4v5.5"/><rect x="7.6" y="11" width="2.6" height="2.4" rx=".5"/>', v: '<path d="M5.5 9 12 4.8 18.5 9v11.5h-13z"/>' },
    schuur: { k: 'net', l: '<path d="M4 20.5V10l8-5.5 8 5.5v10.5"/><path d="M8 20.5v-7h8v7"/><path d="m8 13.5 8 7M16 13.5l-8 7"/>', v: '<path d="M8 13.5h8v7H8z"/>' },
    terras: { k: 'zon', l: '<path d="M12 4v15"/><path d="M4.5 10.5C5 6.6 8.2 4 12 4s7 2.6 7.5 6.5z"/><path d="M7 20.5h10"/>', v: '<path d="M4.5 10.5C5 6.6 8.2 4 12 4s7 2.6 7.5 6.5z"/>' },
    balkon: { k: 'net', l: '<path d="M3.5 12.5h17"/><path d="M5 12.5v8M9 12.5v8M13 12.5v8M17 12.5v8M3.5 20.5h17"/><path d="M7 12.5V4.5h10v8"/>', v: '<path d="M7 4.5h10v8H7z"/>' },
    dak: { k: 'zon', l: '<path d="M2.5 13 12 5.5l9.5 7.5"/><path d="M5 11v8.5h14V11"/><path d="m8.5 9.6 3.5-2.8 3.5 2.8"/>', v: '<path d="M2.5 13 12 5.5l9.5 7.5-2.5-2V19.5H5V11z"/>' },
    deur: { k: 'net', l: '<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21"/><path d="M3.5 21h17"/><circle cx="14.6" cy="12.5" r=".9"/>', v: '<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21z"/>' },
    kamer: { k: 'mint', l: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 12.5h7v8M14 3.5v5"/>', v: '<path d="M10.5 12.5h10V17.5a3 3 0 0 1-3 3h-7z"/>' },
    kamers: { k: 'mint', l: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="2"/><rect x="13" y="13" width="7.5" height="7.5" rx="2"/>', v: '<rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/>' },
    etages: { k: 'mint', l: '<path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16 9 4.5 9-4.5"/>', v: '<path d="M12 3.5 21 8l-9 4.5L3 8z"/>' },
    huis3d: { k: 'mint', l: '<path d="M3.5 10.6 12 4l8.5 6.6"/><path d="M5.5 9.1V20h13V9.1"/><path d="M9 20v-6h6v6"/>', v: '<path d="M9 14h6v6H9z"/>' },

    /* ---- mensen en toegang ---- */
    bewoners: { k: 'mint', l: '<circle cx="9" cy="8.2" r="3.4"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M15.6 5.2a3.2 3.2 0 0 1 0 6.1M17.6 14.3A6 6 0 0 1 21 20"/>', v: '<circle cx="9" cy="8.2" r="3.4"/>' },
    persoon: { k: 'mint', l: '<circle cx="12" cy="8" r="3.8"/><path d="M5 20.5a7 7 0 0 1 14 0"/>', v: '<circle cx="12" cy="8" r="3.8"/>' },
    inloggen: { k: 'violet', l: '<circle cx="8" cy="15.5" r="4.5"/><path d="m11.2 12.3 8.8-8.8M16.5 7l2.5 2.5M14 9.5l2 2"/>', v: '<circle cx="8" cy="15.5" r="4.5"/>' },
    gegevens: { k: 'violet', l: '<ellipse cx="12" cy="5.8" rx="7.5" ry="2.8"/><path d="M4.5 5.8v12.4c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V5.8"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>', v: '<ellipse cx="12" cy="5.8" rx="7.5" ry="2.8"/>' },
    versie: { k: 'violet', l: '<path d="M3.5 12.3V4.8a1.3 1.3 0 0 1 1.3-1.3h7.5l8.2 8.2a1.3 1.3 0 0 1 0 1.8l-7.5 7.5a1.3 1.3 0 0 1-1.8 0z"/><circle cx="8" cy="8" r="1.3"/>', v: '<path d="M3.5 12.3V4.8a1.3 1.3 0 0 1 1.3-1.3h7.5l8.2 8.2a1.3 1.3 0 0 1 0 1.8l-7.5 7.5a1.3 1.3 0 0 1-1.8 0z"/>' },
    afwezig: { k: 'ijs', l: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.6"/><path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2"/><path d="M3.5 12.5h17"/>', v: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.6"/>' },
    naam: { k: 'mint', l: '<rect x="3" y="5" width="18" height="14" rx="2.6"/><circle cx="8.6" cy="11" r="2"/><path d="M5.8 16a3 3 0 0 1 5.6 0M14 10h4M14 13.5h3"/>', v: '<rect x="3" y="5" width="18" height="14" rx="2.6"/>' },
    taal: { k: 'ijs', l: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5z"/>', v: '<circle cx="12" cy="12" r="8.5"/>' },
    kleur: { k: 'violet', l: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1 0 1.6-.7 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6h1.9a4.4 4.4 0 0 0 4.4-4.4c0-4.1-3.8-7-8.5-7z"/><circle cx="7.6" cy="11.4" r="1"/><circle cx="10" cy="7.6" r="1"/><circle cx="14.6" cy="7.8" r="1"/>', v: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1 0 1.6-.7 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6h1.9a4.4 4.4 0 0 0 4.4-4.4c0-4.1-3.8-7-8.5-7z"/>' },
    letters: { k: 'violet', l: '<path d="m3 18.5 4.6-12 4.6 12M4.8 14h5.6"/><path d="M19.5 18.5v-5.2a2.6 2.6 0 0 0-5 0"/><path d="M19.5 15.5c-3.2-.4-5.4.4-5.4 1.8 0 1 .8 1.6 2 1.6 1.6 0 3.4-1 3.4-3.4"/>', v: '' },
    weergave: { k: 'violet', l: '<rect x="3" y="4.5" width="18" height="12.6" rx="2.6"/><path d="M9 20.6h6"/><circle cx="12" cy="10.8" r="2.6"/>', v: '<circle cx="12" cy="10.8" r="2.6"/>' },
    aod: { k: 'violet', l: '<rect x="3" y="4.5" width="18" height="12.6" rx="2.6"/><path d="M9 20.6h6"/><path d="M13.6 8.2a3 3 0 1 0 2.2 4.6 3.6 3.6 0 0 1-2.2-4.6z"/>', v: '<path d="M13.6 8.2a3 3 0 1 0 2.2 4.6 3.6 3.6 0 0 1-2.2-4.6z"/>' },
    uit: { k: 'net', l: '<path d="M12 3.5v7.5"/><path d="M7.2 6.4a7.2 7.2 0 1 0 9.6 0"/>', v: '' },
    kaarten: { k: 'mint', l: '<rect x="3.5" y="3.5" width="7.5" height="10" rx="2"/><rect x="13" y="3.5" width="7.5" height="6" rx="2"/><rect x="3.5" y="15.5" width="7.5" height="5" rx="2"/><rect x="13" y="11.5" width="7.5" height="9" rx="2"/>', v: '<rect x="13" y="11.5" width="7.5" height="9" rx="2"/>' },
    favorieten: { k: 'zon', l: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>', v: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>' },

    /* ---- tijd en planning ---- */
    klok: { k: 'ijs', l: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 2"/>', v: '<circle cx="12" cy="12" r="8.5"/>' },
    straks: { k: 'ijs', l: '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 4v4.5H16"/><path d="M12 7.5V12l3 1.8"/>', v: '' },
    agenda: { k: 'ijs', l: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17.2h2M11 17.2h2"/>', v: '<path d="M3.5 10h17V17.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3z"/>' },
    maand: { k: 'ijs', l: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><rect x="13" y="13.2" width="3.6" height="3.6" rx=".9"/>', v: '<rect x="13" y="13.2" width="3.6" height="3.6" rx=".9"/>' },
    morgen: { k: 'zon', l: '<path d="M3 17.5h18"/><path d="M7.5 17.5a4.5 4.5 0 0 1 9 0"/><path d="M12 4v5M9.5 6.5 12 4l2.5 2.5"/>', v: '<path d="M7.5 17.5a4.5 4.5 0 0 1 9 0z"/>' },
    dagdelen: { k: 'zon', l: '<path d="M12 3.5a8.5 8.5 0 0 1 0 17z"/><circle cx="12" cy="12" r="8.5"/>', v: '<path d="M12 3.5a8.5 8.5 0 0 1 0 17z"/>' },
    taak: { k: 'mint', l: '<circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.2 2.6 2.6 5-5.2"/>', v: '<circle cx="12" cy="12" r="8.5"/>' },
    lijst: { k: 'mint', l: '<path d="M9.5 6.5h11M9.5 12h11M9.5 17.5h11"/><path d="m3.5 6.5 1.2 1.2 2.2-2.2M3.5 12l1.2 1.2 2.2-2.2M3.5 17.5l1.2 1.2 2.2-2.2"/>', v: '' },
    mand: { k: 'mint', l: '<path d="M3.5 9.5h17l-1.6 9a2 2 0 0 1-2 1.6H7.1a2 2 0 0 1-2-1.6z"/><path d="m8 9.5 3-6M16 9.5l-3-6"/><path d="M9.5 13.5v3M14.5 13.5v3"/>', v: '<path d="M3.5 9.5h17l-1.6 9a2 2 0 0 1-2 1.6H7.1a2 2 0 0 1-2-1.6z"/>' },
    bak: { k: 'mint', l: '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/><path d="M6 6.5 7 19a1.6 1.6 0 0 0 1.6 1.5h6.8A1.6 1.6 0 0 0 17 19l1-12.5"/><path d="M10 10.5v6M14 10.5v6"/>', v: '<path d="M6 6.5h12l-1 12.5a1.6 1.6 0 0 1-1.6 1.5H8.6A1.6 1.6 0 0 1 7 19z"/>' },

    /* ---- de assistent en praten ---- */
    praten: { k: 'violet', l: '<path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.6L4.2 20l1.2-3.6A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/>', v: '<path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.6L4.2 20l1.2-3.6A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/>' },
    stem: { k: 'violet', l: '<path d="M4 10.5v3M8 7.5v9M12 4.5v15M16 7.5v9M20 10.5v3"/>', v: '' },
    mic: { k: 'violet', l: '<rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.5"/>', v: '<rect x="9" y="3" width="6" height="11.5" rx="3"/>' },
    taalmodel: { k: 'violet', l: '<path d="M12 5.2A3.2 3.2 0 0 0 6.2 6.6 3.4 3.4 0 0 0 4.5 12.6 3.4 3.4 0 0 0 7 18.4a3.2 3.2 0 0 0 5 1.2z"/><path d="M12 5.2a3.2 3.2 0 0 1 5.8 1.4 3.4 3.4 0 0 1 1.7 6 3.4 3.4 0 0 1-2.5 5.8 3.2 3.2 0 0 1-5 1.2z"/><path d="M12 5.2v14.4"/>', v: '<path d="M12 5.2a3.2 3.2 0 0 1 5.8 1.4 3.4 3.4 0 0 1 1.7 6 3.4 3.4 0 0 1-2.5 5.8 3.2 3.2 0 0 1-5 1.2z"/>' },
    cloud: { k: 'ijs', l: '<path d="M7.2 19h10a3.9 3.9 0 0 0 .4-7.8 5.4 5.4 0 0 0-10.5 1.6A3.1 3.1 0 0 0 7.2 19z"/>', v: '<path d="M7.2 19h10a3.9 3.9 0 0 0 .4-7.8 5.4 5.4 0 0 0-10.5 1.6A3.1 3.1 0 0 0 7.2 19z"/>' },
    nieuw: { k: 'violet', l: '<path d="M12 3.5 13.7 9l5.8 1.7-5.8 1.7L12 18l-1.7-5.6L4.5 10.7 10.3 9z"/><path d="M18.5 16v4M16.5 18h4"/>', v: '<path d="M12 3.5 13.7 9l5.8 1.7-5.8 1.7L12 18l-1.7-5.6L4.5 10.7 10.3 9z"/>' },

    /* ---- staten en handelingen ---- */
    goed: { k: 'mint', l: '<circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.2 2.6 2.6 5-5.2"/>', v: '<circle cx="12" cy="12" r="8.5"/>' },
    vink: { k: 'mint', l: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', v: '' },
    kruis: { k: 'net', l: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', v: '' },
    pijl: { k: 'net', l: '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>', v: '' },
    terug: { k: 'net', l: '<path d="M19 12H5M10.5 6.5 5 12l5.5 5.5"/>', v: '' },
    downloaden: { k: 'ijs', l: '<path d="M12 3.5V15M7 10l5 5 5-5"/><path d="M4.5 19.5h15"/>', v: '' },
    update: { k: 'ijs', l: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v8M8.5 12.5 12 16l3.5-3.5"/>', v: '<circle cx="12" cy="12" r="8.5"/>' },
    onderhoud: { k: 'zon', l: '<path d="M14.6 5.4a4.4 4.4 0 0 0-5.8 5.6l-5 5a2 2 0 0 0 2.8 2.8l5-5a4.4 4.4 0 0 0 5.6-5.8l-2.6 2.6-2.4-.4-.4-2.4z"/>', v: '<path d="M14.6 5.4a4.4 4.4 0 0 0-5.8 5.6l-5 5a2 2 0 0 0 2.8 2.8l5-5a4.4 4.4 0 0 0 5.6-5.8l-2.6 2.6-2.4-.4-.4-2.4z"/>' },
    mijlpaal: { k: 'zon', l: '<path d="M5.5 21V3.5"/><path d="M5.5 4.5h12l-2.6 4 2.6 4h-12"/>', v: '<path d="M5.5 4.5h12l-2.6 4 2.6 4h-12z"/>' },
    stil: { k: 'net', l: '<path d="M8.6 5.8A5.5 5.5 0 0 1 17.5 10v5.5"/><path d="M6.5 9.8v6.7l-1.4 1.5H17"/><path d="M10.2 20.6h3.6M3.5 3.5l17 17"/>', v: '' },
    weg: { k: 'net', l: '<path d="M14 4.5h3.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M4 12h11M10 7l-5 5 5 5"/>', v: '' },
    oog: { k: 'violet', l: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>', v: '<circle cx="12" cy="12" r="3"/>' },
    verborgen: { k: 'net', l: '<path d="M9.9 5.7A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.5M6.6 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4.6-1.2"/><path d="M3.5 3.5l17 17"/>', v: '' },
    greep: { k: 'net', l: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>', v: '' },
    standaard: { k: 'net', l: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>', v: '' },
    los: { k: 'net', l: '<rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="2.5 3"/>', v: '' },
    koffer: { k: 'ijs', l: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.6"/><path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2"/><path d="M3.5 12.5h17"/>', v: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.6"/>' },
    bed: { k: 'violet', l: '<path d="M3 18.6v-7.4a2.1 2.1 0 0 1 2.1-2.1h13.8a2.1 2.1 0 0 1 2.1 2.1v7.4"/><path d="M3 15.2h18"/><path d="M6 9.1V6.6A1.6 1.6 0 0 1 7.6 5h8.8A1.6 1.6 0 0 1 18 6.6v2.5"/>', v: '<path d="M3 15.2v-4a2.1 2.1 0 0 1 2.1-2.1h13.8a2.1 2.1 0 0 1 2.1 2.1v4z"/>' },
    weer: { k: 'ijs', l: '<path d="M9.2 4.8a3.8 3.8 0 0 1 5.6 2.6"/><path d="M12 2.3v.9M6 4.6l.6.6M4.3 9.8h.9"/><path d="M7.2 19.5h10a3.9 3.9 0 0 0 .4-7.8 5.4 5.4 0 0 0-10.5 1.6 3.1 3.1 0 0 0 .1 6.2z"/>', v: '<path d="M7.2 19.5h10a3.9 3.9 0 0 0 .4-7.8 5.4 5.4 0 0 0-10.5 1.6 3.1 3.1 0 0 0 .1 6.2z"/>' },
    nu: { k: 'mint', l: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>', v: '<circle cx="12" cy="12" r="3"/>' },
  };

  /** De oude namen uit de pagina's, naar een tekening hierboven. */
  const ALIAS = {
    lamp: 'licht', thermo: 'klimaat', temp: 'klimaat', praat: 'praten', tel: 'telefoon', zonnepanelen: 'panelen', meters: 'meter',
    cameras: 'camera', rookmelder: 'rook', regeling: 'voorrang', functies: 'kaarten', toegang: 'inloggen', energie: 'zon', inrichten: 'lijst',
    logeerkamer: 'bed', woonkeuken: 'keuken', bijkeuken: 'keuken', wasruimte: 'witgoed', bank: 'woonkamer', scherm: 'wand', apparaten2: 'apparaat',
    bel: 'meldingen', meldbel: 'meldingen', koelen: 'koel', verwarmen: 'warm', huis: 'thuis', zonnig: 'zon', telefoonapp: 'telefoon', klimaatbrug: 'thermostaat',
  };

  const naamVan = (naam) => (I[naam] ? naam : (ALIAS[naam] ?? null));

  /**
   * Het icoon als svg. `zonderVlak` alleen de lijn; `grootte` in pixels (anders
   * vult de css het); `label` maakt het leesbaar voor een schermlezer.
   */
  function svg(naam, o = {}) {
    const id = naamVan(naam);
    const ik = id ? I[id] : null;
    if (!ik) return '';
    const kleur = K[ik.k] ?? K.net;
    const maat = o.grootte ? ` width="${o.grootte}" height="${o.grootte}"` : '';
    const toegankelijk = o.label ? ` role="img" aria-label="${String(o.label).replace(/"/g, '&quot;')}"` : ' aria-hidden="true"';
    const vlak = ik.v && !o.zonderVlak ? `<g class="ik-vlak" fill="${kleur}" fill-opacity="0.26" stroke="none">${ik.v}</g>` : '';
    return `<svg class="ik${o.klasse ? ` ${o.klasse}` : ''}" viewBox="0 0 24 24"${maat} fill="none" stroke-linecap="round" stroke-linejoin="round" style="--ik: ${kleur}"${toegankelijk}>${vlak}<g class="ik-lijn" stroke="currentColor" stroke-width="1.6">${ik.l}</g></svg>`;
  }

  /**
   * Alleen de binnenkant (vlak en lijn), voor een bestaand omhulsel van een
   * pagina: de lijn neemt de kleur van het omhulsel over, met de dikte van de
   * set. Het vlak houdt de kleur van het onderwerp.
   */
  function binnen(naam) {
    const id = naamVan(naam);
    const ik = id ? I[id] : null;
    if (!ik) return '';
    const vlak = ik.v ? `<g class="ik-vlak" fill="${K[ik.k] ?? K.net}" fill-opacity="0.26" stroke="none">${ik.v}</g>` : '';
    return `${vlak}<g class="ik-lijn" stroke-width="1.6">${ik.l}</g>`;
  }

  /** De kleur van een onderwerp, voor wat er naast het icoon staat. */
  const kleur = (naam) => K[I[naamVan(naam)]?.k] ?? K.net;

  global.iconen = { svg, binnen, kleur, heeft: (naam) => naamVan(naam) != null, namen: () => Object.keys(I) };
})(window);
