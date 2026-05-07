import { GeminiProvider } from './src/llm/GeminiProvider.js';

// We can just verify the tools were packed correctly.
import fs from 'fs';
const bundled = fs.readFileSync('src/blueprints/BundledFleets.ts', 'utf8');

if (bundled.includes("business_of_you'.")) {
    console.log("SUCCESS: business_of_you is explicitly allowed in the schema.");
} else {
    console.error("FAIL: Schema update not found in BundledFleets!");
}

if (bundled.includes("name: install_fleet")) {
    console.log("SUCCESS: install_fleet tool is present in the bundle.");
} else {
    console.error("FAIL: install_fleet tool missing from bundle!");
}
