const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
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