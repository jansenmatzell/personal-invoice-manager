const { Notification } = require('electron');
const path = require('path');

// Check if notifications are supported
const isNotificationSupported = () => {
  return Notification.isSupported();
};

// Send invoice created notification
const sendInvoiceCreatedNotification = (invoiceNumber, customerName, amount) => {
  if (!isNotificationSupported()) return;

  const notification = new Notification({
    title: 'Invoice Created',
    body: `Invoice #${invoiceNumber} for ${customerName} has been created.\nAmount: ${formatCurrency(amount)}`,
    icon: path.join(__dirname, 'assets/icons/invoice-created.png')
  });

  notification.show();
};

// Send invoice paid notification
const sendInvoicePaidNotification = (invoiceNumber, customerName, amount) => {
  if (!isNotificationSupported()) return;

  const notification = new Notification({
    title: 'Payment Received',
    body: `Invoice #${invoiceNumber} for ${customerName} has been marked as paid.\nAmount: ${formatCurrency(amount)}`,
    icon: path.join(__dirname, 'assets/icons/invoice-paid.png')
  });

  notification.show();
};

// Send invoice due soon notification
const sendInvoiceDueSoonNotification = (invoiceNumber, customerName, dueDate, amount) => {
  if (!isNotificationSupported()) return;

  const notification = new Notification({
    title: 'Invoice Due Soon',
    body: `Invoice #${invoiceNumber} for ${customerName} is due on ${formatDate(dueDate)}.\nAmount: ${formatCurrency(amount)}`,
    icon: path.join(__dirname, 'assets/icons/invoice-due.png')
  });

  notification.show();
};

// Send invoice overdue notification
const sendInvoiceOverdueNotification = (invoiceNumber, customerName, dueDate, amount) => {
  if (!isNotificationSupported()) return;

  const notification = new Notification({
    title: 'Invoice Overdue',
    body: `Invoice #${invoiceNumber} for ${customerName} was due on ${formatDate(dueDate)}.\nAmount: ${formatCurrency(amount)}`,
    icon: path.join(__dirname, 'assets/icons/invoice-overdue.png')
  });

  notification.show();
};

// Send export completed notification
const sendExportCompletedNotification = (exportType, fileName) => {
  if (!isNotificationSupported()) return;

  const notification = new Notification({
    title: 'Export Completed',
    body: `Your ${exportType} export has been saved as ${fileName}`,
    icon: path.join(__dirname, 'assets/icons/export-completed.png')
  });

  notification.show();
};

// Check for upcoming and overdue invoices
const checkInvoiceDueDates = async (db) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(today.getDate() + 3);
  
  const todayStr = formatDateForDb(today);
  const threeDaysStr = formatDateForDb(threeDaysFromNow);
  
  try {
    // Check for invoices due in the next 3 days
    const dueSoonInvoices = await db.all(`
      SELECT i.invoice_id, i.invoice_number, i.due_date, i.total_amount, c.name 
      FROM invoices i 
      JOIN customers c ON i.customer_id = c.customer_id 
      WHERE i.status = 'Pending' 
      AND i.due_date BETWEEN ? AND ?
    `, [todayStr, threeDaysStr]);
    
    // Check for overdue invoices
    const overdueInvoices = await db.all(`
      SELECT i.invoice_id, i.invoice_number, i.due_date, i.total_amount, c.name 
      FROM invoices i 
      JOIN customers c ON i.customer_id = c.customer_id 
      WHERE i.status = 'Pending' 
      AND i.due_date < ?
    `, [todayStr]);
    
    // Send notifications
    dueSoonInvoices.forEach(invoice => {
      sendInvoiceDueSoonNotification(
        invoice.invoice_number,
        invoice.name,
        invoice.due_date,
        invoice.total_amount
      );
    });
    
    overdueInvoices.forEach(invoice => {
      sendInvoiceOverdueNotification(
        invoice.invoice_number,
        invoice.name,
        invoice.due_date,
        invoice.total_amount
      );
    });
  } catch (error) {
    console.error('Error checking invoice due dates:', error);
  }
};

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

// Helper function to format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

// Helper function to format date for DB queries
const formatDateForDb = (date) => {
  return date.toISOString().split('T')[0];
};

module.exports = {
  sendInvoiceCreatedNotification,
  sendInvoicePaidNotification,
  sendInvoiceDueSoonNotification,
  sendInvoiceOverdueNotification,
  sendExportCompletedNotification,
  checkInvoiceDueDates
};