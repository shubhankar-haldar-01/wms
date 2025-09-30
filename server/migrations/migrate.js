const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );
    
    await pool.query(schemaSQL);
    console.log('Database schema created successfully!');
    
    // Insert default admin user
    const bcrypt = require('bcryptjs');
    const defaultPassword = await bcrypt.hash('admin123', 10);
    
    await pool.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ('admin', 'admin@wms.com', $1, 'admin')
      ON CONFLICT (username) DO NOTHING
    `, [defaultPassword]);
    
    console.log('Default admin user created (username: admin, password: admin123)');
    
    // Insert sample data
    await insertSampleData();
    
    console.log('Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

async function insertSampleData() {
  try {
    // Insert sample products
    const products = [
      { 
        name: 'Laptop Computer', 
        sku: 'LAP001', 
        price: 999.99, 
        initial_stock: 50,
        hsn_code: '84713000',
        gst_rate: 18,
        origin: 'China' 
      },
      { 
        name: 'Wireless Mouse', 
        sku: 'MOU001', 
        price: 29.99, 
        initial_stock: 100,
        hsn_code: '84716000',
        gst_rate: 18,
        origin: 'Taiwan' 
      },
      { 
        name: 'USB Cable', 
        sku: 'CAB001', 
        price: 9.99, 
        initial_stock: 200,
        hsn_code: '85444900',
        gst_rate: 18,
        origin: 'China' 
      },
      { 
        name: 'Monitor 24"', 
        sku: 'MON001', 
        price: 299.99, 
        initial_stock: 25,
        hsn_code: '85285200',
        gst_rate: 18,
        origin: 'South Korea' 
      },
      { 
        name: 'Keyboard Mechanical', 
        sku: 'KEY001', 
        price: 89.99, 
        initial_stock: 75,
        hsn_code: '84716000',
        gst_rate: 18,
        origin: 'Germany' 
      }
    ];
    
    for (const product of products) {
      // First check if the product already exists
      const existingProduct = await pool.query('SELECT id FROM products WHERE sku = $1', [product.sku]);
      
      if (existingProduct.rows.length === 0) {
        await pool.query(`
          INSERT INTO products (name, sku, price, initial_stock, current_stock, hsn_code, gst_rate, origin, low_stock_threshold)
          VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8)
        `, [product.name, product.sku, product.price, product.initial_stock, product.hsn_code, product.gst_rate, product.origin, 10]);
      }
    }
    
    console.log('Sample products inserted');
    
    // Insert sample barcodes
    const barcodes = [
      { sku: 'LAP001', barcode: '1234567890123', units: 50 },
      { sku: 'LAP001', barcode: '1234567890124', units: 30 },
      { sku: 'MOU001', barcode: '2345678901234', units: 100 },
      { sku: 'CAB001', barcode: '3456789012345', units: 200 },
      { sku: 'MON001', barcode: '4567890123456', units: 25 },
      { sku: 'KEY001', barcode: '5678901234567', units: 75 }
    ];
    
    for (const barcode of barcodes) {
      const productResult = await pool.query('SELECT id FROM products WHERE sku = $1', [barcode.sku]);
      if (productResult.rows.length > 0) {
        const productId = productResult.rows[0].id;
        
        await pool.query(`
          INSERT INTO barcodes (product_id, barcode, units_assigned)
          VALUES ($1, $2, $3)
          ON CONFLICT (barcode) DO NOTHING
        `, [productId, barcode.barcode, barcode.units]);
        
        // Insert initial stock transaction
        const barcodeResult = await pool.query('SELECT id FROM barcodes WHERE barcode = $1', [barcode.barcode]);
        if (barcodeResult.rows.length > 0) {
          const barcodeId = barcodeResult.rows[0].id;
          
          await pool.query(`
            INSERT INTO stock_transactions (product_id, barcode_id, transaction_type, quantity, reference_number, notes, created_by)
            VALUES ($1, $2, 'IN', $3, 'INITIAL_STOCK', 'Initial stock entry', 'system')
          `, [productId, barcodeId, barcode.units]);
        }
      }
    }
    
    console.log('Sample barcodes and initial stock inserted');
    
  } catch (error) {
    console.error('Error inserting sample data:', error);
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };