const { jsPDF } = require('jspdf');
const path = require('path');
const fs = require('fs');
const { dialog, app } = require('electron');
const { sendExportCompletedNotification } = require('./notifications');

/**
 * Export an invoice to PDF
 * @param {Object} db - SQLite database instance
 * @param {Number} invoiceId - The ID of the invoice to export
 * @param {Object} mainWindow - The main Electron window
 * @returns {Promise<String>} - The path to the saved PDF file
 */
const exportInvoiceToPdf = async (db, invoiceId, mainWindow) => {
  try {
    console.log(`Starting PDF export for invoice ID: ${invoiceId}`);
    
    // Get invoice details
    const invoice = await db.getAsync(`
      SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.address as customer_address
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.customer_id
      WHERE i.invoice_id = ?
    `, [invoiceId]);

    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }
    
    console.log(`Retrieved invoice details: ${invoice.invoice_number}`);

    // Get invoice items
    const invoiceItems = await db.allAsync(`
      SELECT * FROM invoice_items WHERE invoice_id = ?
    `, [invoiceId]);

    console.log(`Retrieved ${invoiceItems ? invoiceItems.length : 0} invoice items`);
    
    // Verify we have an array
    if (!Array.isArray(invoiceItems)) {
      console.error('Invoice items is not an array:', invoiceItems);
      throw new Error('Invoice items data is not in the expected format');
    }

    // Create a new PDF document
    const doc = new jsPDF();
    
    // Add company logo/header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Personal Invoice Manager', 105, 20, { align: 'center' });
    
    // Add invoice information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice #: ${invoice.invoice_number}`, 15, 40);
    doc.text(`Issue Date: ${formatDate(invoice.issue_date)}`, 15, 47);
    doc.text(`Due Date: ${formatDate(invoice.due_date)}`, 15, 54);
    doc.text(`Status: ${invoice.status}`, 15, 61);
    
    // Add customer information
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 120, 40);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.customer_name || 'N/A', 120, 47);
    
    if (invoice.customer_address) {
      const addressLines = invoice.customer_address.split('\n');
      let yPos = 54;
      for (const line of addressLines) {
        doc.text(line, 120, yPos);
        yPos += 7;
      }
    }
    
    if (invoice.customer_email) {
      doc.text(`Email: ${invoice.customer_email}`, 120, 75);
    }
    
    if (invoice.customer_phone) {
      doc.text(`Phone: ${invoice.customer_phone}`, 120, 82);
    }
    
    // Add line items header
    doc.setFillColor(240, 240, 240);
    doc.rect(15, 95, 180, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 20, 102);
    doc.text('Quantity', 100, 102);
    doc.text('Unit Price', 130, 102);
    doc.text('Amount', 170, 102);
    
    // Add line items
    let yPos = 115;
    doc.setFont('helvetica', 'normal');
    
    if (invoiceItems && invoiceItems.length > 0) {
      for (const item of invoiceItems) {
        // Handle description wrapping
        const descriptionLines = doc.splitTextToSize(item.description, 70);
        doc.text(descriptionLines, 20, yPos);
        
        // Adjust Y position for multi-line descriptions
        const lineHeight = descriptionLines.length * 7;
        
        // Add other item details
        doc.text(String(item.quantity), 100, yPos);
        doc.text(formatCurrency(item.unit_price), 130, yPos);
        doc.text(formatCurrency(item.amount), 170, yPos);
        
        yPos += Math.max(lineHeight, 10); // Ensure minimum spacing
        
        // Add a new page if needed
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
      }
    } else {
      // No items to display
      doc.text('No items on this invoice', 20, yPos);
      yPos += 10;
    }
    
    // Add totals
    yPos += 10;
    doc.line(15, yPos - 5, 195, yPos - 5);
    doc.text('Subtotal:', 130, yPos + 5);
    doc.text(formatCurrency(invoice.subtotal), 170, yPos + 5);
    
    doc.text(`Tax (${invoice.tax_rate}%):`, 130, yPos + 15);
    doc.text(formatCurrency(invoice.tax_amount), 170, yPos + 15);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', 130, yPos + 25);
    doc.text(formatCurrency(invoice.total_amount), 170, yPos + 25);
    
    // Add notes if available
    if (invoice.notes) {
      yPos += 40;
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', 15, yPos);
      doc.setFont('helvetica', 'normal');
      
      const noteLines = doc.splitTextToSize(invoice.notes, 180);
      doc.text(noteLines, 15, yPos + 10);
    }
    
    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(
        `Generated on ${new Date().toLocaleDateString()} - Page ${i} of ${pageCount}`,
        105, 290, { align: 'center' }
      );
    }
    
    try {
      // Show save dialog
      const defaultFileName = `Invoice_${invoice.invoice_number.replace(/\s+/g, '_')}.pdf`;
      const documentsPath = app.getPath('documents');
      
      console.log('Opening save dialog for PDF export');
      const savePath = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Invoice as PDF',
        defaultPath: path.join(documentsPath, defaultFileName),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });
      
      if (savePath.canceled) {
        console.log('PDF export canceled by user');
        return null;
      }
      
      // Save the file
      doc.save(savePath.filePath);
      console.log(`PDF saved to: ${savePath.filePath}`);
      
      // Send notification
      sendExportCompletedNotification('PDF', path.basename(savePath.filePath));
      
      return savePath.filePath;
    } catch (error) {
      console.error('Error saving PDF:', error);
      throw new Error(`Failed to save PDF: ${error.message}`);
    }
  } catch (error) {
    console.error('Error exporting invoice to PDF:', error);
    throw error;
  }
};

// Helper function to format date
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString();
};

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

module.exports = { exportInvoiceToPdf };