const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const { dialog, app } = require('electron');
const { sendExportCompletedNotification } = require('./notifications');

/**
 * Export all invoices to a CSV file
 * @param {Object} db - SQLite database instance
 * @param {Object} mainWindow - The main Electron window
 * @returns {Promise<String>} - The path to the saved CSV file
 */
const exportInvoicesToCsv = async (db, mainWindow) => {
  try {
    // Get all invoices with customer information
    const invoices = await db.all(`
      SELECT 
        i.invoice_id, 
        i.invoice_number, 
        i.issue_date, 
        i.due_date, 
        i.status, 
        i.subtotal, 
        i.tax_rate, 
        i.tax_amount, 
        i.total_amount,
        i.notes,
        c.name as customer_name, 
        c.email as customer_email,
        c.phone as customer_phone
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.customer_id
      ORDER BY i.issue_date DESC
    `);

    if (invoices.length === 0) {
      throw new Error('No invoices found to export');
    }

    // Show save dialog
    const defaultFileName = `Invoices_Export_${formatDateForFileName(new Date())}.csv`;
    const savePath = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Invoices as CSV',
      defaultPath: path.join(app.getPath('documents'), defaultFileName),
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });
    
    if (savePath.canceled) {
      return null;
    }

    // Configure CSV writer
    const csvWriter = createObjectCsvWriter({
      path: savePath.filePath,
      header: [
        { id: 'invoice_number', title: 'Invoice Number' },
        { id: 'customer_name', title: 'Customer Name' },
        { id: 'customer_email', title: 'Customer Email' },
        { id: 'customer_phone', title: 'Customer Phone' },
        { id: 'issue_date', title: 'Issue Date' },
        { id: 'due_date', title: 'Due Date' },
        { id: 'status', title: 'Status' },
        { id: 'subtotal', title: 'Subtotal' },
        { id: 'tax_rate', title: 'Tax Rate (%)' },
        { id: 'tax_amount', title: 'Tax Amount' },
        { id: 'total_amount', title: 'Total Amount' },
        { id: 'notes', title: 'Notes' }
      ]
    });

    // Format data for CSV
    const csvData = invoices.map(invoice => ({
      ...invoice,
      issue_date: formatDate(invoice.issue_date),
      due_date: formatDate(invoice.due_date),
      notes: invoice.notes || ''
    }));

    // Write to CSV
    await csvWriter.writeRecords(csvData);
    
    // Send notification
    sendExportCompletedNotification('CSV', path.basename(savePath.filePath));
    
    return savePath.filePath;
  } catch (error) {
    console.error('Error exporting invoices to CSV:', error);
    throw error;
  }
};

/**
 * Export invoice items to a CSV file
 * @param {Object} db - SQLite database instance
 * @param {Number} invoiceId - The ID of the invoice to export items from
 * @param {Object} mainWindow - The main Electron window
 * @returns {Promise<String>} - The path to the saved CSV file
 */
const exportInvoiceItemsToCsv = async (db, invoiceId, mainWindow) => {
  try {
    // Get invoice details
    const invoice = await db.get(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.customer_id
      WHERE i.invoice_id = ?
    `, [invoiceId]);

    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }

    // Get invoice items
    const invoiceItems = await db.all(`
      SELECT * FROM invoice_items WHERE invoice_id = ?
    `, [invoiceId]);

    if (invoiceItems.length === 0) {
      throw new Error('No items found for this invoice');
    }

    // Show save dialog
    const defaultFileName = `Invoice_${invoice.invoice_number.replace(/\s+/g, '_')}_Items.csv`;
    const savePath = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Invoice Items as CSV',
      defaultPath: path.join(app.getPath('documents'), defaultFileName),
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });
    
    if (savePath.canceled) {
      return null;
    }

    // Configure CSV writer
    const csvWriter = createObjectCsvWriter({
      path: savePath.filePath,
      header: [
        { id: 'invoice_number', title: 'Invoice Number' },
        { id: 'description', title: 'Description' },
        { id: 'quantity', title: 'Quantity' },
        { id: 'unit_price', title: 'Unit Price' },
        { id: 'amount', title: 'Amount' }
      ]
    });

    // Format data for CSV
    const csvData = invoiceItems.map(item => ({
      invoice_number: invoice.invoice_number,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount
    }));

    // Write to CSV
    await csvWriter.writeRecords(csvData);
    
    // Send notification
    sendExportCompletedNotification('CSV', path.basename(savePath.filePath));
    
    return savePath.filePath;
  } catch (error) {
    console.error('Error exporting invoice items to CSV:', error);
    throw error;
  }
};

// Helper function to format date
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString();
};

// Helper function to format date for file name
const formatDateForFileName = (date) => {
  return date.toISOString().split('T')[0].replace(/-/g, '');
};

module.exports = { exportInvoicesToCsv, exportInvoiceItemsToCsv };