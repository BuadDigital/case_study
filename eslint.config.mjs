// Hooks guard for every workspace. `apps/shell` keeps its own Next config for the
// rest of its rules; this one only enforces the React hooks contract repo-wide,
// because most hooks live outside the shell and were never linted.
// Run it with `npm run lint:hooks`.
import hooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";

/** Registered but all off: source files carry `eslint-disable @next/next/...`
 *  comments, and an unknown rule in a disable comment is itself an error. */
const nextRulesOff = Object.fromEntries(
  Object.keys(nextPlugin.rules).map((name) => [`@next/next/${name}`, "off"]),
);

export default [
  {
    files: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
    ignores: ["**/.next/**", "**/node_modules/**", "**/dist/**", "**/build/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "react-hooks": hooks, "@next/next": nextPlugin },
    rules: {
      ...nextRulesOff,
      // Zero offenders today — keep them that way.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/no-deriving-state-in-effects": "error",
      "react-hooks/set-state-in-render": "error",
      "react-hooks/component-hook-factories": "error",
      "react-hooks/capitalized-calls": "error",
      "react-hooks/error-boundaries": "error",
      "react-hooks/globals": "error",
      "react-hooks/purity": "error",
      "react-hooks/void-use-memo": "error",
      // Known backlog — warnings so the build stays green while the count comes down.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/memoized-effect-dependencies": "warn",
    },
  },
];
