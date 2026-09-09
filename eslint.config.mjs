import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { globalIgnores } from "eslint/config";

// eslint-config-next@15.x still ships the legacy eslintrc format (its
// native flat-config export lands in v16); bridge it with FlatCompat.
// Loaded via createRequire — Next's internal lint step's module resolution
// doesn't reliably follow @eslint/eslintrc's ESM "exports" condition.
const require = createRequire(import.meta.url);
const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: fileURLToPath(new URL(".", import.meta.url)),
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // docs/design-canvas.html + docs/support.js are design references, not
  // app code (see docs/build-prompt.md § 1) — never lint or edit them.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "docs/**"]),
];

export default eslintConfig;
