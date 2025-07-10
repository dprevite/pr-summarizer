import js from "@eslint/js";
import globals from "globals";
import * as tseslint from "typescript-eslint";

export default [
    js.configs.recommended,
    {files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], languageOptions: {globals: globals.browser}},
    ...tseslint.configs.recommended,
    {
        ignores: ["dist/**", "node_modules/**", "lib/**"]
    },
    {
        files: ["**/*.test.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off"
        }
    },
    {
        files: ["jest.config.js"],
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    }
];
