# personal-invoice-manager
Track and manage invoices with an export feature.

## Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later recommended)
- npm (comes with Node.js)
- Git (optional, for cloning the repository)

## Installation
1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd personal-invoice-manager
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the App
Start the Electron application in development mode:
```bash
npm run electron-dev
```
This launches the React development server and Electron.

## Packaging
Create a distributable package:
```bash
npm run dist
```
The packaged application will be output to the `dist` directory.

## Troubleshooting
- **Database errors:** ensure `database_schema.sql` exists and the app can create the database in the user data folder. If the database becomes corrupt, delete the database directory and restart the app.
- **Blank window:** the React dev server might not have started. Verify port 3000 is free and rerun `npm run electron-dev`. You can also clear the app cache or run `npm run clean` and try again.
