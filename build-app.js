const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building Personal Invoice Manager...');

// Clean old builds
console.log('Cleaning old builds...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

// Build React app
console.log('Building React app...');
execSync('npm run react-build', { stdio: 'inherit' });

// Create a temporary electron-builder config without icons
const tempConfig = {
  appId: "com.example.personal-invoice-manager",
  productName: "Personal Invoice Manager",
  directories: {
    output: "dist"
  },
  files: [
    "build/**/*",
    "*.js",
    "database_schema.sql",
    "node_modules/**/*"
  ],
  extraMetadata: {
    main: "main.js"
  },
  win: {
    target: "portable",
    icon: null  // Explicitly set to null
  },
  portable: {
    artifactName: "PersonalInvoiceManager.exe"
  },
  asar: false
};

// Write temporary config
fs.writeFileSync('electron-builder-temp.json', JSON.stringify(tempConfig, null, 2));

// Package with electron-builder using temp config
console.log('Packaging application...');
try {
  execSync('npx electron-builder --config electron-builder-temp.json', { stdio: 'inherit' });
} catch (error) {
  console.error('Build failed:', error.message);
  // Clean up temp file
  if (fs.existsSync('electron-builder-temp.json')) {
    fs.unlinkSync('electron-builder-temp.json');
  }
  process.exit(1);
}

// Clean up temp file
if (fs.existsSync('electron-builder-temp.json')) {
  fs.unlinkSync('electron-builder-temp.json');
}

console.log('Build complete! Check the dist folder.');