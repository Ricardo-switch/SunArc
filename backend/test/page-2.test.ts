// Deel 2 van 4 van de paginatests (zie page.suite.ts): een eigen proces, een eigen server en browser.
(globalThis as { __paginaDeel?: { deel: number; van: number } }).__paginaDeel = { deel: 2, van: 4 };
await import('./page.suite.js');
export {};
