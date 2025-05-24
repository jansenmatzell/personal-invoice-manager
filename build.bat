@echo off
echo Cleaning old builds...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

echo Building React app...
call npx react-scripts build

echo Creating dist folder...
mkdir dist

echo Copying files to dist...
xcopy /E /I build dist\build
copy main.js dist\
copy preload.js dist\
copy database_schema.sql dist\
copy notifications.js dist\
copy exportPdf.js dist\
copy exportCsv.js dist\
copy db.js dist\
copy package.json dist\

echo Installing production dependencies...
cd dist
npm install --only=production
cd ..

echo Build complete! Run the app using 'electron dist'