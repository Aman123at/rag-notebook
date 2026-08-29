import next from "eslint-config-next";
import nextWebVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...next,
  ...nextWebVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "src/contract/**", ".agents/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];

export default config;
