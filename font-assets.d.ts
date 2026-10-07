// Vite turns `?url` imports into the hashed public path of the file (used to preload the fonts in app/layout.tsx).
declare module "*?url" {
  const src: string;
  export default src;
}
