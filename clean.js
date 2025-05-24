const fs = require('fs');
const path = require('path');

function removeFolder(folderPath) {
  if (fs.existsSync(folderPath)) {
    console.log(`Removing ${folderPath}...`);
    fs.rmSync(folderPath, { recursive: true, force: true });
    console.log(`Removed ${folderPath}`);
  } else {
    console.log(`Folder not found: ${folderPath}`);
  }
}

// Folders to clean
removeFolder(path.join(__dirname, 'dist'));
removeFolder(path.join(__dirname, 'build'));