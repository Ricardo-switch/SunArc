// De instellingen van de testmotor (vitest 5, 17 november 2026).
//
// Eén ruimere tijdslimiet voor elke test. Met vitest 5 draaide een handvol
// zware tests (een jaar per uur rekenen, duizend toestanden) op de bouwserver
// net boven de standaard van 5 seconden, terwijl ze lokaal in 3 seconden klaar
// zijn. Een test die echt vastloopt, valt met 20 seconden nog steeds om.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 20_000,
  },
});
