@echo off
echo Building React app...
call npm run react-build

echo Packaging with electron-packager...
npx electron-packager . PersonalInvoiceManager --platform=win32 --arch=x64 --out=release --overwrite --prune=true --ignore="\.git|src|public|\.gitignore|README\.md"

echo Build complete! Check the release folder.
pause