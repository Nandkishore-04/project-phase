const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('./backend/uploads/invoices/sample_gst_invoice.pdf'));

doc.fontSize(20).text('GST Invoice', { align: 'center' });
doc.moveDown();
doc.fontSize(12).text('Invoice Number: INV-1001');
doc.text('Invoice Date: 2025-10-21');
doc.text('Supplier Name: ABC Traders');
doc.text('Supplier GSTIN: 29ABCDE1234F1Z5');
doc.text('Supplier Address: 123 Main Street, Bengaluru, Karnataka');
doc.moveDown();
doc.text('Item Name: Widget A');
doc.text('HSN Code: 1234');
doc.text('Quantity: 10');
doc.text('Unit Price: 100');
doc.text('GST Rate: 18%');
doc.text('Amount: 1000');
doc.moveDown();
doc.text('Subtotal: 1000');
doc.text('CGST: 90');
doc.text('SGST: 90');
doc.text('IGST: 0');
doc.text('Total Amount: 1180');
doc.end();

console.log('Sample GST invoice PDF generated at ./backend/uploads/invoices/sample_gst_invoice.pdf');
