import React, { useState, useEffect } from 'react';
import InvoiceList from './InvoiceList';
import InvoiceForm from './InvoiceForm';
import './App.css';

const App = () => {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [view, setView] = useState('list'); // 'list' or 'form'

  // Load data on initial render
  useEffect(() => {
    loadInvoices();
    loadCustomers();
  }, []);

  // Load invoices from the database
  const loadInvoices = async () => {
    try {
      const result = await window.electronAPI.getInvoices();
      console.log('Loaded invoices:', result);
      setInvoices(result);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  // Load customers from the database
  const loadCustomers = async () => {
    try {
      const result = await window.electronAPI.getCustomers();
      console.log('Loaded customers:', result);
      setCustomers(result);
      return result;
    } catch (error) {
      console.error('Error loading customers:', error);
      return [];
    }
  };

  // Handle creating a new invoice
  const handleNewInvoice = () => {
    setSelectedInvoice(null);
    setView('form');
  };

  // Handle editing an existing invoice
  const handleEditInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setView('form');
  };

  // Handle deleting an invoice
  const handleDeleteInvoice = async (invoiceId) => {
    try {
      await window.electronAPI.deleteInvoice(invoiceId);
      loadInvoices(); // Refresh the list
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  // Handle saving an invoice (create or update)
  const handleSaveInvoice = async (invoiceData) => {
    try {
      if (selectedInvoice) {
        // Update existing invoice
        await window.electronAPI.updateInvoice({
          ...invoiceData,
          invoice_id: selectedInvoice.invoice_id
        });
      } else {
        // Create new invoice
        await window.electronAPI.createInvoice(invoiceData);
      }
      
      setView('list');
      loadInvoices(); // Refresh the list
    } catch (error) {
      console.error('Error saving invoice:', error);
    }
  };

  // Handle canceling invoice creation/editing
  const handleCancelForm = () => {
    setSelectedInvoice(null);
    setView('list');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Personal Invoice Manager</h1>
      </header>
      
      <main className="app-main">
        {view === 'list' ? (
          <InvoiceList 
            invoices={invoices}
            onNewInvoice={handleNewInvoice}
            onEditInvoice={handleEditInvoice}
            onDeleteInvoice={handleDeleteInvoice}
          />
        ) : (
          <InvoiceForm 
            invoice={selectedInvoice}
            customers={customers}
            onSave={handleSaveInvoice}
            onCancel={handleCancelForm}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Personal Invoice Manager © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default App;