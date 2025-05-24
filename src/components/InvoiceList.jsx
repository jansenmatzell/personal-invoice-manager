import React, { useState } from 'react';
import './InvoiceList.css';

const InvoiceList = ({ invoices, onNewInvoice, onEditInvoice, onDeleteInvoice }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('issue_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Handle sort column change
  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle export to PDF
  const handleExportPdf = async (invoice) => {
    try {
      await window.electronAPI.exportInvoiceToPdf(invoice.invoice_id);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
    }
  };

  // Handle export to CSV
  const handleExportCsv = async () => {
    try {
      await window.electronAPI.exportInvoicesToCsv();
    } catch (error) {
      console.error('Error exporting to CSV:', error);
    }
  };

  // Filter and sort invoices
  const filteredInvoices = invoices
    .filter(invoice => 
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.status.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      if (a[sortField] > b[sortField]) {
        comparison = 1;
      } else if (a[sortField] < b[sortField]) {
        comparison = -1;
      }
      return sortDirection === 'desc' ? comparison * -1 : comparison;
    });

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Get status class for styling
  const getStatusClass = (status) => {
    switch (status.toLowerCase()) {
      case 'paid': return 'status-paid';
      case 'overdue': return 'status-overdue';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-pending';
    }
  };

  return (
    <div className="invoice-list-container">
      <div className="invoice-list-header">
        <h2>Invoices</h2>
        <div className="list-actions">
          <button className="primary-button" onClick={onNewInvoice}>Create New Invoice</button>
          <button className="secondary-button" onClick={handleExportCsv}>Export All to CSV</button>
        </div>
      </div>
      
      <div className="search-container">
        <input
          type="text"
          placeholder="Search invoices..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>
      
      {filteredInvoices.length > 0 ? (
        <table className="invoice-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('invoice_number')}>Invoice #</th>
              <th onClick={() => handleSort('customer_name')}>Customer</th>
              <th onClick={() => handleSort('issue_date')}>Issue Date</th>
              <th onClick={() => handleSort('due_date')}>Due Date</th>
              <th onClick={() => handleSort('status')}>Status</th>
              <th onClick={() => handleSort('total_amount')}>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map(invoice => (
              <tr key={invoice.invoice_id}>
                <td>{invoice.invoice_number}</td>
                <td>{invoice.customer_name}</td>
                <td>{formatDate(invoice.issue_date)}</td>
                <td>{formatDate(invoice.due_date)}</td>
                <td>
                  <span className={`status-badge ${getStatusClass(invoice.status)}`}>
                    {invoice.status}
                  </span>
                </td>
                <td>{formatCurrency(invoice.total_amount)}</td>
                <td className="action-buttons">
                  <button 
                    className="icon-button edit-button" 
                    onClick={() => onEditInvoice(invoice)}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button 
                    className="icon-button pdf-button" 
                    onClick={() => handleExportPdf(invoice)}
                    title="Export to PDF"
                  >
                    📄
                  </button>
                  {confirmDelete === invoice.invoice_id ? (
                    <button 
                      className="icon-button confirm-delete-button" 
                      onClick={() => {
                        onDeleteInvoice(invoice.invoice_id);
                        setConfirmDelete(null);
                      }}
                      title="Confirm Delete"
                    >
                      ✓
                    </button>
                  ) : (
                    <button 
                      className="icon-button delete-button" 
                      onClick={() => setConfirmDelete(invoice.invoice_id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="no-invoices">
          <p>No invoices found. Create your first invoice!</p>
        </div>
      )}
    </div>
  );
};

export default InvoiceList;