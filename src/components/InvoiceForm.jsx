import React, { useState, useEffect } from 'react';
import './InvoiceForm.css';

const InvoiceForm = ({ invoice, customers, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    customer_id: '',
    invoice_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Pending',
    notes: '',
    subtotal: 0,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 0,
    items: [{ description: '', quantity: 1, unit_price: 0, amount: 0 }]
  });
  
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  
  // Store customers in local state
  const [localCustomers, setLocalCustomers] = useState(customers || []);

  // Populate form when editing an existing invoice
  useEffect(() => {
    if (invoice) {
      const fetchInvoiceDetails = async () => {
        try {
          const invoiceData = await window.electronAPI.getInvoiceDetails(invoice.invoice_id);
          setFormData({
            ...invoiceData,
            items: invoiceData.items.length > 0 ? invoiceData.items : [{ description: '', quantity: 1, unit_price: 0, amount: 0 }]
          });
        } catch (error) {
          console.error('Error fetching invoice details:', error);
        }
      };

      fetchInvoiceDetails();
    }
  }, [invoice]);

  // Update local customers when props change
  useEffect(() => {
    console.log('Customers prop updated:', customers);
    setLocalCustomers(customers || []);
  }, [customers]);

  // Handle input change for form fields
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle input change for line items
  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    const newItems = [...formData.items];
    
    newItems[index] = {
      ...newItems[index],
      [name]: value
    };

    // Calculate the line item amount
    if (name === 'quantity' || name === 'unit_price') {
      newItems[index].amount = newItems[index].quantity * newItems[index].unit_price;
    }

    setFormData(prev => ({
      ...prev,
      items: newItems
    }));
    
    // Recalculate totals
    calculateTotals(newItems);
  };

  // Add a new line item
  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit_price: 0, amount: 0 }]
    }));
  };

  // Remove a line item
  const handleRemoveItem = (index) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    
    setFormData(prev => ({
      ...prev,
      items: newItems.length > 0 ? newItems : [{ description: '', quantity: 1, unit_price: 0, amount: 0 }]
    }));
    
    // Recalculate totals
    calculateTotals(newItems);
  };

  // Calculate subtotal, tax, and total
  const calculateTotals = (items) => {
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const taxRate = parseFloat(formData.tax_rate) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;
    
    setFormData(prev => ({
      ...prev,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount
    }));
  };

  // Handle tax rate change
  const handleTaxRateChange = (e) => {
    const taxRate = parseFloat(e.target.value) || 0;
    const taxAmount = formData.subtotal * (taxRate / 100);
    const totalAmount = formData.subtotal + taxAmount;
    
    setFormData(prev => ({
      ...prev,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount
    }));
  };
  
  // Handle saving a new customer
  const handleSaveCustomer = async () => {
    try {
      // Validate customer name
      if (!newCustomer.name.trim()) {
        alert('Customer name is required');
        return;
      }
      
      console.log('Saving customer:', newCustomer);
      
      // Save customer to database
      const customerId = await window.electronAPI.createCustomer(newCustomer);
      console.log('Customer created with ID:', customerId);
      
      // Fetch updated customer list
      const updatedCustomers = await window.electronAPI.getCustomers();
      console.log('Updated customers list:', updatedCustomers);
      
      // Update local customers state
      setLocalCustomers(updatedCustomers);
      
      // Update form data with new customer
      setFormData(prev => ({
        ...prev,
        customer_id: customerId.toString()
      }));
      
      // Hide customer form
      setShowCustomerForm(false);
      
      // Reset new customer form
      setNewCustomer({
        name: '',
        email: '',
        phone: '',
        address: ''
      });
      
      console.log('Customer saved and form updated');
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Failed to create customer: ' + error.message);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitting form data:', formData);
    onSave(formData);
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Log whenever the customer selection dropdown content changes
  useEffect(() => {
    console.log('Customer dropdown updated. Selected ID:', formData.customer_id);
    console.log('Available customers:', localCustomers.map(c => ({ id: c.customer_id, name: c.name })));
  }, [localCustomers, formData.customer_id]);

  return (
    <div className="invoice-form-container">
      <h2>{invoice ? 'Edit Invoice' : 'Create New Invoice'}</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-header">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="customer_id">Customer</label>
              <div className="customer-select-container">
                <select 
                  id="customer_id" 
                  name="customer_id" 
                  value={formData.customer_id} 
                  onChange={handleInputChange}
                  required={!showCustomerForm}
                  disabled={showCustomerForm}
                >
                  <option value="">Select a customer</option>
                  {localCustomers.map(customer => (
                    <option key={customer.customer_id} value={customer.customer_id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <button 
                  type="button"
                  className="new-customer-button"
                  onClick={() => setShowCustomerForm(!showCustomerForm)}
                >
                  {showCustomerForm ? 'Cancel' : 'New Customer'}
                </button>
              </div>
              
              {showCustomerForm && (
                <div className="new-customer-form">
                  <h4>Add New Customer</h4>
                  <div className="form-group">
                    <label htmlFor="new-customer-name">Customer Name*</label>
                    <input 
                      type="text" 
                      id="new-customer-name" 
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-customer-email">Email</label>
                    <input 
                      type="email" 
                      id="new-customer-email" 
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-customer-phone">Phone</label>
                    <input 
                      type="text" 
                      id="new-customer-phone" 
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-customer-address">Address</label>
                    <textarea 
                      id="new-customer-address" 
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                      rows="3"
                    ></textarea>
                  </div>
                  <div className="customer-form-actions">
                    <button type="button" onClick={() => setShowCustomerForm(false)}>Cancel</button>
                    <button type="button" onClick={handleSaveCustomer}>Save Customer</button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="invoice_number">Invoice Number</label>
              <input 
                type="text" 
                id="invoice_number" 
                name="invoice_number" 
                value={formData.invoice_number} 
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="issue_date">Issue Date</label>
              <input 
                type="date" 
                id="issue_date" 
                name="issue_date" 
                value={formData.issue_date} 
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="due_date">Due Date</label>
              <input 
                type="date" 
                id="due_date" 
                name="due_date" 
                value={formData.due_date} 
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select 
                id="status" 
                name="status" 
                value={formData.status} 
                onChange={handleInputChange}
                required
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="line-items-container">
          <h3>Line Items</h3>
          <table className="line-items-table">
            <thead>
              <tr>
                <th width="40%">Description</th>
                <th width="15%">Quantity</th>
                <th width="20%">Unit Price</th>
                <th width="20%">Amount</th>
                <th width="5%"></th>
              </tr>
            </thead>
            <tbody>
              {formData.items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <input 
                      type="text" 
                      name="description" 
                      value={item.description} 
                      onChange={(e) => handleItemChange(index, e)}
                      required
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      name="quantity" 
                      min="0.01" 
                      step="0.01" 
                      value={item.quantity} 
                      onChange={(e) => handleItemChange(index, e)}
                      required
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      name="unit_price" 
                      min="0" 
                      step="0.01" 
                      value={item.unit_price} 
                      onChange={(e) => handleItemChange(index, e)}
                      required
                    />
                  </td>
                  <td className="amount-cell">
                    {formatCurrency(item.amount)}
                  </td>
                  <td>
                    <button 
                      type="button" 
                      className="remove-item-button" 
                      onClick={() => handleRemoveItem(index)}
                      disabled={formData.items.length === 1}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <button 
            type="button" 
            className="add-item-button" 
            onClick={handleAddItem}
          >
            + Add Item
          </button>
        </div>

        <div className="invoice-totals">
          <div className="totals-row">
            <label>Subtotal:</label>
            <span>{formatCurrency(formData.subtotal)}</span>
          </div>
          
          <div className="totals-row">
            <div className="tax-rate-input">
              <label htmlFor="tax_rate">Tax Rate (%):</label>
              <input 
                type="number" 
                id="tax_rate" 
                name="tax_rate" 
                min="0" 
                step="0.01" 
                value={formData.tax_rate} 
                onChange={handleTaxRateChange}
              />
            </div>
            <span>{formatCurrency(formData.tax_amount)}</span>
          </div>
          
          <div className="totals-row total">
            <label>Total:</label>
            <span>{formatCurrency(formData.total_amount)}</span>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="notes">Notes</label>
          <textarea 
            id="notes" 
            name="notes" 
            value={formData.notes} 
            onChange={handleInputChange}
            rows="3"
          ></textarea>
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="save-button">
            {invoice ? 'Update Invoice' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InvoiceForm;