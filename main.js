const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');

// Setup logging to desktop and app data
function log(message) {
  try {
    // Log to desktop
    const logDir = path.join(app.getPath('desktop'), 'invoice-app-logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'invoice-app.log');
    fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
    
    // Also log to userData
    const appLogDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(appLogDir)) {
      fs.mkdirSync(appLogDir, { recursive: true });
    }
    const appLogFile = path.join(appLogDir, 'app.log');
    fs.appendFileSync(appLogFile, `${new Date().toISOString()} - ${message}\n`);
    
    console.log(message);
  } catch (error) {
    console.error('Error writing to log:', error);
  }
}

// Global error handler
process.on('uncaughtException', (error) => {
  const errorMsg = `CRASH: ${error.message}\n${error.stack}`;
  log(errorMsg);
  
  if (app.isReady()) {
    dialog.showErrorBox('Application Error', errorMsg);
  }
});

// Log application paths
log('Application starting');
log(`App path: ${app.getAppPath()}`);
log(`User data path: ${app.getPath('userData')}`);
log(`Executable path: ${app.getPath('exe')}`);
log(`Current working directory: ${process.cwd()}`);

// Load dependencies with better error handling
let db = null;
let notifications = null;
let exportPdf = null;
let exportCsv = null;

// Global references
let mainWindow;

// Find resource files
function getResourcePath(relativePath) {
  try {
    const possiblePaths = [
      // Development paths
      path.join(app.getAppPath(), relativePath),
      path.join(process.cwd(), relativePath),
      
      // Production paths
      path.join(path.dirname(app.getPath('exe')), relativePath),
      path.join(path.dirname(app.getPath('exe')), 'resources', 'app', relativePath),
      path.join(path.dirname(app.getPath('exe')), 'resources', relativePath)
    ];
    
    for (const checkPath of possiblePaths) {
      log(`Checking for ${relativePath} at: ${checkPath}`);
      if (fs.existsSync(checkPath)) {
        log(`Found ${relativePath} at: ${checkPath}`);
        return checkPath;
      }
    }
    
    log(`Resource not found: ${relativePath}`);
    return null;
  } catch (error) {
    log(`Error finding resource ${relativePath}: ${error.message}`);
    return null;
  }
}

// Initialize database
async function initDatabase() {
  try {
    log('Initializing database');
    
    // First try to load better-sqlite3
    try {
      const dbJsPath = getResourcePath('db.js');
      if (dbJsPath) {
        log(`Loading database module from: ${dbJsPath}`);
        const { initDatabase } = require(dbJsPath);
        db = await initDatabase();
        log('Database initialized successfully with better-sqlite3');
        return db;
      }
    } catch (error) {
      log(`Error initializing better-sqlite3: ${error.message}`);
    }
    
    // If that fails, create an in-memory database as fallback
    log('Creating in-memory database as fallback');
    db = createInMemoryDb();
    log('Fallback database initialized');
    return db;
  } catch (error) {
    log(`Database initialization error: ${error.message}`);
    throw error;
  }
}

// Create a simple in-memory database as fallback
function createInMemoryDb() {
  return {
    customers: [
      { customer_id: 1, name: 'Example Customer', email: 'example@example.com' }
    ],
    invoices: [
      { invoice_id: 1, invoice_number: 'INV-001', customer_id: 1, total_amount: 100, status: 'Pending', customer_name: 'Example Customer' }
    ],
    invoice_items: [
      { item_id: 1, invoice_id: 1, description: 'Example Item', quantity: 1, unit_price: 100, amount: 100 }
    ],
    
    // Simplified database methods
    getAsync: (sql, params) => {
      log(`DB query: ${sql} with params: ${JSON.stringify(params)}`);
      if (sql.includes('customers')) {
        return Promise.resolve({ customer_id: 1, name: 'Example Customer' });
      } else if (sql.includes('invoices')) {
        return Promise.resolve({ invoice_id: 1, invoice_number: 'INV-001', customer_id: 1 });
      }
      return Promise.resolve(null);
    },
    
    allAsync: (sql) => {
      log(`DB query all: ${sql}`);
      if (sql.includes('customers')) {
        return Promise.resolve([
          { customer_id: 1, name: 'Example Customer', email: 'example@example.com' }
        ]);
      } else if (sql.includes('invoices')) {
        return Promise.resolve([
          { invoice_id: 1, invoice_number: 'INV-001', customer_id: 1, total_amount: 100, status: 'Pending', customer_name: 'Example Customer' }
        ]);
      } else if (sql.includes('invoice_items')) {
        return Promise.resolve([
          { item_id: 1, invoice_id: 1, description: 'Example Item', quantity: 1, unit_price: 100, amount: 100 }
        ]);
      }
      return Promise.resolve([]);
    },
    
    runAsync: (sql) => {
      log(`DB run: ${sql}`);
      return Promise.resolve({ lastID: 1, changes: 1 });
    }
  };
}

// Initialize modules
async function initModules() {
  try {
    log('Initializing modules');
    
    // Try to load the real modules first
    try {
      const notificationsPath = getResourcePath('notifications.js');
      if (notificationsPath) {
        notifications = require(notificationsPath);
        log('Loaded notifications module');
      }
      
      const exportPdfPath = getResourcePath('exportPdf.js');
      if (exportPdfPath) {
        exportPdf = require(exportPdfPath);
        log('Loaded exportPdf module');
      }
      
      const exportCsvPath = getResourcePath('exportCsv.js');
      if (exportCsvPath) {
        exportCsv = require(exportCsvPath);
        log('Loaded exportCsv module');
      }
    } catch (error) {
      log(`Error loading modules: ${error.message}`);
    }
    
    // Create stub implementations for any missing modules
    if (!notifications) {
      notifications = {
        sendInvoiceCreatedNotification: () => log('Notification: Invoice created'),
        sendInvoicePaidNotification: () => log('Notification: Invoice paid'),
        checkInvoiceDueDates: () => log('Checking invoice due dates (stub)')
      };
      log('Created notification stubs');
    }
    
    if (!exportPdf) {
      exportPdf = {
        exportInvoiceToPdf: () => {
          log('PDF export requested (stub)');
          dialog.showMessageBox({
            type: 'info',
            title: 'PDF Export',
            message: 'PDF export is not available in this version.'
          });
          return Promise.resolve(null);
        }
      };
      log('Created exportPdf stubs');
    }
    
    if (!exportCsv) {
      exportCsv = {
        exportInvoicesToCsv: () => {
          log('CSV export requested (stub)');
          dialog.showMessageBox({
            type: 'info',
            title: 'CSV Export',
            message: 'CSV export is not available in this version.'
          });
          return Promise.resolve(null);
        },
        exportInvoiceItemsToCsv: () => {
          log('CSV items export requested (stub)');
          dialog.showMessageBox({
            type: 'info',
            title: 'CSV Export',
            message: 'CSV export is not available in this version.'
          });
          return Promise.resolve(null);
        }
      };
      log('Created exportCsv stubs');
    }
    
    log('Modules initialization complete');
  } catch (error) {
    log(`Error initializing modules: ${error.message}`);
    throw error;
  }
}

// Determine the correct path to the build directory
function getBuildPath() {
  try {
    // In development mode, serve from localhost
    if (isDev) {
      log('In development mode, using localhost:3000');
      return 'http://localhost:3000';
    }
    
    // Check all possible build locations
    const possiblePaths = [
      path.join(app.getAppPath(), 'build', 'index.html'),
      path.join(app.getAppPath(), '..', 'build', 'index.html'),
      path.join(path.dirname(app.getPath('exe')), 'build', 'index.html'),
      path.join(path.dirname(app.getPath('exe')), 'resources', 'build', 'index.html'),
      path.join(path.dirname(app.getPath('exe')), 'resources', 'app', 'build', 'index.html'),
      path.join(path.dirname(app.getPath('exe')), 'resources', 'app.asar', 'build', 'index.html')
    ];
    
    for (const buildPath of possiblePaths) {
      log(`Checking for build at: ${buildPath}`);
      if (fs.existsSync(buildPath)) {
        log(`Found build at: ${buildPath}`);
        return `file://${buildPath}`;
      }
    }
    
    log('React build not found, using fallback HTML');
    return getFallbackHtmlUrl();
  } catch (error) {
    log(`Error determining build path: ${error.message}`);
    return getFallbackHtmlUrl();
  }
}

// Get fallback HTML content
function getFallbackHtmlContent() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Personal Invoice Manager</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f5f8fa;
          color: #333;
        }
        .app-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        .app-header {
          background-color: #2c3e50;
          color: white;
          padding: 1rem;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .app-main {
          flex: 1;
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        .app-footer {
          background-color: #f5f5f5;
          padding: 1rem;
          text-align: center;
          font-size: 0.8rem;
          color: #777;
          margin-top: auto;
        }
        .invoice-list-container {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          padding: 1.5rem;
        }
        .invoice-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .button {
          background-color: #3498db;
          color: white;
          border: none;
          padding: 0.6rem 1.2rem;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.3s;
        }
        .button:hover {
          background-color: #2980b9;
        }
        .invoice-table {
          width: 100%;
          border-collapse: collapse;
        }
        .invoice-table th {
          text-align: left;
          padding: 0.8rem;
          background-color: #f8f9fa;
          border-bottom: 2px solid #ddd;
        }
        .invoice-table td {
          padding: 0.8rem;
          border-bottom: 1px solid #eee;
        }
        .status-badge {
          display: inline-block;
          padding: 0.3rem 0.6rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        .status-paid {
          background-color: #d4edda;
          color: #155724;
        }
        .status-pending {
          background-color: #fff3cd;
          color: #856404;
        }
        .status-overdue {
          background-color: #f8d7da;
          color: #721c24;
        }
        .status-cancelled {
          background-color: #e2e3e5;
          color: #383d41;
        }
        .error-message {
          margin-top: 20px;
          padding: 10px;
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
          color: #721c24;
        }
      </style>
    </head>
    <body>
      <div class="app-container">
        <header class="app-header">
          <h1>Personal Invoice Manager</h1>
        </header>
        
        <main class="app-main">
          <div class="invoice-list-container">
            <div class="invoice-list-header">
              <h2>Example Invoices</h2>
              <div>
                <button class="button" id="createBtn">Create New Invoice</button>
              </div>
            </div>
            
            <div class="error-message">
              <p><strong>Note:</strong> This is a fallback interface. The full application UI could not be loaded.</p>
              <p>This could be because:</p>
              <ul>
                <li>The React build files were not found</li>
                <li>There was an error loading the application resources</li>
              </ul>
              <p>Basic functionality is still available.</p>
            </div>
            
            <table class="invoice-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="invoicesBody">
                <tr>
                  <td colspan="6">Loading invoices...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </main>

        <footer class="app-footer">
          <p>Personal Invoice Manager © ${new Date().getFullYear()}</p>
        </footer>
      </div>
      
      <script>
        // Load invoices when the page loads
        document.addEventListener('DOMContentLoaded', async () => {
          try {
            // Get invoices from the backend
            const invoices = await window.electronAPI.getInvoices();
            
            // Clear loading message
            document.getElementById('invoicesBody').innerHTML = '';
            
            // Display invoices
            if (invoices && invoices.length > 0) {
              invoices.forEach(invoice => {
                const row = document.createElement('tr');
                
                // Format date
                const date = new Date(invoice.issue_date);
                const formattedDate = date.toLocaleDateString();
                
                // Format amount
                const amount = new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD'
                }).format(invoice.total_amount);
                
                // Determine status class
                let statusClass = 'status-pending';
                if (invoice.status === 'Paid') statusClass = 'status-paid';
                if (invoice.status === 'Overdue') statusClass = 'status-overdue';
                if (invoice.status === 'Cancelled') statusClass = 'status-cancelled';
                
                row.innerHTML = \`
                  <td>\${invoice.invoice_number}</td>
                  <td>\${invoice.customer_name || 'N/A'}</td>
                  <td>\${formattedDate}</td>
                  <td><span class="status-badge \${statusClass}">\${invoice.status}</span></td>
                  <td>\${amount}</td>
                  <td>
                    <button class="view-btn" data-id="\${invoice.invoice_id}">View</button>
                  </td>
                \`;
                
                document.getElementById('invoicesBody').appendChild(row);
              });
              
              // Add event listeners to view buttons
              document.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                  const id = btn.getAttribute('data-id');
                  try {
                    const details = await window.electronAPI.getInvoiceDetails(id);
                    alert(JSON.stringify(details, null, 2));
                  } catch (error) {
                    alert('Error: ' + error.message);
                  }
                });
              });
            } else {
              document.getElementById('invoicesBody').innerHTML = '<tr><td colspan="6">No invoices found</td></tr>';
            }
          } catch (error) {
            document.getElementById('invoicesBody').innerHTML = \`<tr><td colspan="6">Error loading invoices: \${error.message}</td></tr>\`;
          }
        });
        
        // Create invoice button
        document.getElementById('createBtn').addEventListener('click', async () => {
          try {
            // Get customers
            const customers = await window.electronAPI.getCustomers();
            
            if (customers && customers.length > 0) {
              const customerName = customers[0].name;
              alert(\`You would create a new invoice for \${customerName} here. This functionality is limited in the fallback UI.\`);
            } else {
              alert('No customers found. Please add a customer first.');
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        });
      </script>
    </body>
    </html>
  `;
}

// Create a data URL for the fallback HTML
function getFallbackHtmlUrl() {
  const html = getFallbackHtmlContent();
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

// Create a temporary preload script
async function createTempPreload() {
  try {
    // First check if the original preload exists
    const originalPreloadPath = getResourcePath('preload.js');
    if (originalPreloadPath) {
      log(`Found original preload at: ${originalPreloadPath}`);
      return originalPreloadPath;
    }
    
    // If not, create a temporary one
    log('Creating temporary preload script');
    const tempDir = path.join(app.getPath('temp'), 'invoice-manager');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const preloadPath = path.join(tempDir, 'preload.js');
    const preloadContent = `
      const { contextBridge, ipcRenderer } = require('electron');
      
      contextBridge.exposeInMainWorld('electronAPI', {
        // Invoice operations
        getInvoices: () => ipcRenderer.invoke('get-invoices'),
        getInvoiceDetails: (invoiceId) => ipcRenderer.invoke('get-invoice-details', invoiceId),
        createInvoice: (invoiceData) => ipcRenderer.invoke('create-invoice', invoiceData),
        updateInvoice: (invoiceData) => ipcRenderer.invoke('update-invoice', invoiceData),
        deleteInvoice: (invoiceId) => ipcRenderer.invoke('delete-invoice', invoiceId),
        
        // Customer operations
        getCustomers: () => ipcRenderer.invoke('get-customers'),
        createCustomer: (customerData) => ipcRenderer.invoke('create-customer', customerData),
        
        // Export operations
        exportInvoiceToPdf: (invoiceId) => ipcRenderer.invoke('export-invoice-to-pdf', invoiceId),
        exportInvoicesToCsv: () => ipcRenderer.invoke('export-invoices-to-csv'),
        exportInvoiceItemsToCsv: (invoiceId) => ipcRenderer.invoke('export-invoice-items-to-csv', invoiceId)
      });
    `;
    
    fs.writeFileSync(preloadPath, preloadContent);
    log(`Created temporary preload at: ${preloadPath}`);
    return preloadPath;
  } catch (error) {
    log(`Error creating preload: ${error.message}`);
    throw error;
  }
}

// Create window
async function createWindow() {
  try {
    log('Creating main window');
    
    // Get preload path
    const preloadPath = await createTempPreload();
    
    // Create the browser window
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath
      },
      show: false // Don't show until loaded
    });

    // Set up IPC handlers
    setupIpcHandlers();

    // Load the app
    const startUrl = getBuildPath();
    log(`Loading application from: ${startUrl}`);
    
    await mainWindow.loadURL(startUrl);
    
    mainWindow.once('ready-to-show', () => {
      log('Window ready to show');
      mainWindow.show();
    });

    // Open DevTools in development mode
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }

    // Check for invoice due dates when the app starts
    if (notifications) {
      notifications.checkInvoiceDueDates(db);
      
      // Set up a timer to check for due dates every day
      setInterval(() => {
        notifications.checkInvoiceDueDates(db);
      }, 24 * 60 * 60 * 1000);
    }
    
    log('Window created successfully');
    
    mainWindow.on('closed', () => {
      log('Main window closed');
      mainWindow = null;
    });
  } catch (error) {
    log(`Error creating window: ${error.message}`);
    throw error;
  }
}

// Set up IPC handlers
function setupIpcHandlers() {
  // Get all invoices
  ipcMain.handle('get-invoices', async () => {
    try {
      return await db.allAsync(`
        SELECT 
          i.invoice_id, 
          i.invoice_number, 
          i.issue_date, 
          i.due_date, 
          i.status, 
          i.total_amount,
          c.name as customer_name
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.customer_id
        ORDER BY i.issue_date DESC
      `);
    } catch (error) {
      log(`Error fetching invoices: ${error.message}`);
      throw error;
    }
  });

  // Get all customers
  ipcMain.handle('get-customers', async () => {
    try {
      return await db.allAsync('SELECT * FROM customers ORDER BY name');
    } catch (error) {
      log(`Error fetching customers: ${error.message}`);
      throw error;
    }
  });

  // Create a new customer
  ipcMain.handle('create-customer', async (event, customerData) => {
    try {
      log(`Creating customer: ${JSON.stringify(customerData)}`);
      const result = await db.runAsync(`
        INSERT INTO customers (name, email, phone, address)
        VALUES (?, ?, ?, ?)
      `, [
        customerData.name,
        customerData.email || null,
        customerData.phone || null,
        customerData.address || null
      ]);
      
      log(`Customer created with ID: ${result.lastID}`);
      return result.lastID;
    } catch (error) {
      log(`Error creating customer: ${error.message}`);
      throw error;
    }
  });

  // Get invoice details
  ipcMain.handle('get-invoice-details', async (event, invoiceId) => {
    try {
      // Get invoice
      const invoice = await db.getAsync(`
        SELECT * FROM invoices WHERE invoice_id = ?
      `, [invoiceId]);
      
      if (!invoice) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }
      
      // Get invoice items
      const items = await db.allAsync(`
        SELECT * FROM invoice_items WHERE invoice_id = ?
      `, [invoiceId]);
      
      return {
        ...invoice,
        items
      };
    } catch (error) {
      log(`Error fetching invoice details: ${error.message}`);
      throw error;
    }
  });

  // Create a new invoice
  ipcMain.handle('create-invoice', async (event, invoiceData) => {
    try {
      // Start a transaction
      await db.runAsync('BEGIN TRANSACTION');
      
      // Insert invoice
      const { items, ...invoice } = invoiceData;
      const result = await db.runAsync(`
        INSERT INTO invoices (
          customer_id, invoice_number, issue_date, due_date, status, 
          notes, subtotal, tax_rate, tax_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoice.customer_id, invoice.invoice_number, invoice.issue_date, 
        invoice.due_date, invoice.status, invoice.notes, invoice.subtotal, 
        invoice.tax_rate, invoice.tax_amount, invoice.total_amount
      ]);
      
      const invoiceId = result.lastID;
      
      // Insert invoice items
      for (const item of items) {
        await db.runAsync(`
          INSERT INTO invoice_items (
            invoice_id, description, quantity, unit_price, amount
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          invoiceId, item.description, item.quantity, item.unit_price, item.amount
        ]);
      }
      
      // Commit transaction
      await db.runAsync('COMMIT');
      
      // Get customer name for notification
      const customer = await db.getAsync('SELECT name FROM customers WHERE customer_id = ?', [invoice.customer_id]);
      
      // Send notification
      if (notifications) {
        notifications.sendInvoiceCreatedNotification(
          invoice.invoice_number, 
          customer ? customer.name : 'Customer', 
          invoice.total_amount
        );
      }
      
      return invoiceId;
    } catch (error) {
      // Rollback transaction on error
      await db.runAsync('ROLLBACK');
      log(`Error creating invoice: ${error.message}`);
      throw error;
    }
  });

  // Update an existing invoice
  ipcMain.handle('update-invoice', async (event, invoiceData) => {
    try {
      // Start a transaction
      await db.runAsync('BEGIN TRANSACTION');
      
      const { items, invoice_id, ...invoice } = invoiceData;
      
      // Get the previous status
      const prevInvoice = await db.getAsync('SELECT status, customer_id FROM invoices WHERE invoice_id = ?', [invoice_id]);
      
      // Update invoice
      await db.runAsync(`
        UPDATE invoices SET
          customer_id = ?, invoice_number = ?, issue_date = ?, due_date = ?, 
          status = ?, notes = ?, subtotal = ?, tax_rate = ?, 
          tax_amount = ?, total_amount = ?
        WHERE invoice_id = ?
      `, [
        invoice.customer_id, invoice.invoice_number, invoice.issue_date, 
        invoice.due_date, invoice.status, invoice.notes, invoice.subtotal, 
        invoice.tax_rate, invoice.tax_amount, invoice.total_amount, invoice_id
      ]);
      
      // Delete all existing invoice items
      await db.runAsync('DELETE FROM invoice_items WHERE invoice_id = ?', [invoice_id]);
      
      // Insert new invoice items
      for (const item of items) {
        await db.runAsync(`
          INSERT INTO invoice_items (
            invoice_id, description, quantity, unit_price, amount
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          invoice_id, item.description, item.quantity, item.unit_price, item.amount
        ]);
      }
      
      // Commit transaction
      await db.runAsync('COMMIT');
      
      // Check if status changed to Paid
      if (prevInvoice && notifications && prevInvoice.status !== 'Paid' && invoice.status === 'Paid') {
        // Get customer name for notification
        const customer = await db.getAsync('SELECT name FROM customers WHERE customer_id = ?', [invoice.customer_id]);
        
        // Send notification
        notifications.sendInvoicePaidNotification(
          invoice.invoice_number, 
          customer ? customer.name : 'Customer', 
          invoice.total_amount
        );
      }
      
      return invoice_id;
    } catch (error) {
      // Rollback transaction on error
      await db.runAsync('ROLLBACK');
      log(`Error updating invoice: ${error.message}`);
      throw error;
    }
  });

  // Delete an invoice
  ipcMain.handle('delete-invoice', async (event, invoiceId) => {
    try {
      // Start a transaction
      await db.runAsync('BEGIN TRANSACTION');
      
      // Delete invoice items first (due to foreign key constraint)
      await db.runAsync('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
      
      // Delete invoice
      await db.runAsync('DELETE FROM invoices WHERE invoice_id = ?', [invoiceId]);
      
      // Commit transaction
      await db.runAsync('COMMIT');
      
      return true;
    } catch (error) {
      // Rollback transaction on error
      await db.runAsync('ROLLBACK');
      log(`Error deleting invoice: ${error.message}`);
      throw error;
    }
  });

  // Export invoice to PDF
  ipcMain.handle('export-invoice-to-pdf', async (event, invoiceId) => {
    try {
      if (exportPdf) {
        return await exportPdf.exportInvoiceToPdf(db, invoiceId, mainWindow);
      } else {
        log('PDF export not available');
        throw new Error('PDF export is not available');
      }
    } catch (error) {
      log(`Error exporting invoice to PDF: ${error.message}`);
      throw error;
    }
  });

  // Export invoices to CSV
  ipcMain.handle('export-invoices-to-csv', async () => {
    try {
      if (exportCsv) {
        return await exportCsv.exportInvoicesToCsv(db, mainWindow);
      } else {
        log('CSV export not available');
        throw new Error('CSV export is not available');
      }
    } catch (error) {
      log(`Error exporting invoices to CSV: ${error.message}`);
      throw error;
    }
  });

  // Export invoice items to CSV
  ipcMain.handle('export-invoice-items-to-csv', async (event, invoiceId) => {
    try {
      if (exportCsv) {
        return await exportCsv.exportInvoiceItemsToCsv(db, invoiceId, mainWindow);
      } else {
        log('CSV export not available');
        throw new Error('CSV export is not available');
      }
    } catch (error) {
      log(`Error exporting invoice items to CSV: ${error.message}`);
      throw error;
    }
  });
}

// Initialize application
async function initApp() {
  try {
    log('Initializing application');
    
    // Initialize database first
    await initDatabase();
    
    // Then initialize modules
    await initModules();
    
    // Create the main window
    await createWindow();
    
    log('Application initialized successfully');
  } catch (error) {
    log(`Error initializing application: ${error.message}`);
    dialog.showErrorBox('Initialization Error', `Failed to initialize application: ${error.message}`);
  }
}

// App ready event
app.whenReady().then(() => {
  log('App ready');
  initApp();
}).catch(error => {
  log(`Error in app.whenReady: ${error.message}`);
  dialog.showErrorBox('Startup Error', `Failed to start application: ${error.message}`);
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  log('App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    initApp();
  }
});