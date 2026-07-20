// Lets TypeScript treat imported .md files as raw string modules
// (paired with the webpack `asset/source` rule in next.config.mjs).
declare module "*.md" {
  const content: string;
  export default content;
}
