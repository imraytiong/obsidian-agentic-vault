import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		rules: {
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-floating-promises": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/require-await": "off",
			"@typescript-eslint/no-misused-promises": "off",
			"@typescript-eslint/restrict-template-expressions": "off",
			"obsidianmd/ui/sentence-case": "off",
			"obsidianmd/no-static-styles-assignment": "off",
			"obsidianmd/no-forbidden-elements": "off",
			"import/no-nodejs-modules": "off",
			"no-restricted-globals": "off",
			"no-console": "off",
			"@typescript-eslint/no-base-to-string": "off",
			"@typescript-eslint/no-unsafe-function-type": "off",
			"@typescript-eslint/no-require-imports": "off",
			"no-undef": "off",
			"obsidianmd/settings-tab/no-problematic-settings-headings": "off",
			"@microsoft/sdl/no-inner-html": "off",
			"@typescript-eslint/no-deprecated": "off",
			"no-useless-escape": "off",
			"no-empty": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"obsidianmd/hardcoded-config-path": "off",
			"no-alert": "off",
			"@typescript-eslint/unbound-method": "off",
			"@typescript-eslint/prefer-promise-reject-errors": "off"
		}
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		"test-vault",
		"test-vault-headless",
		"test-vault-tools",
		"test-vaults",
		"dev-sandbox",
		"**/*.js",
		"**/*.mjs",
		"test_resolver.ts"
	]),
);
