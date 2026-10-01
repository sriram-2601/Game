import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir = process.cwd();
const zipName = "netlify-ready-game.zip";
const targetZip = path.join(rootDir, zipName);
const desktopZip = path.join("C:\\Users\\srira\\Desktop", zipName);

// Files and folders to include
const includes = [
  "netlify.toml",
  "package.json",
  "package-lock.json",
  "index.html",
  "tsconfig.json",
  "vite.config.ts",
  "README.md",
  "cover.jpg",
  "src",
  "lib",
  "netlify",
  "public",
  "dist"
];

console.log("📦 Packaging netlify-ready-game.zip...");

// Remove existing zip if any
if (fs.existsSync(targetZip)) {
  fs.unlinkSync(targetZip);
}

const itemsList = includes.map(i => `'${i}'`).join(", ");
const psCommand = `powershell -Command "Compress-Archive -Path ${itemsList} -DestinationPath '${targetZip}' -Force"`;

execSync(psCommand, { stdio: "inherit" });
console.log(`✓ Created: ${targetZip}`);

// Copy to Desktop for direct access
try {
  fs.copyFileSync(targetZip, desktopZip);
  console.log(`✓ Copied to Desktop: ${desktopZip}`);
} catch (err) {
  console.warn("Could not copy to Desktop:", err);
}

const stats = fs.statSync(targetZip);
console.log(`✓ File size: ${(stats.size / 1024).toFixed(1)} KB`);
