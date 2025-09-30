const { pool } = require("../config/database");
const bcrypt = require("bcryptjs");

// Production data samples
const productionProducts = [
  {
    name: "Samsung Galaxy S24 Ultra",
    sku: "SGS24U-256",
    description: "Latest flagship smartphone with 256GB storage",
    category: "Electronics",
    price: 1199.99,
    stock_quantity: 25,
    unit: "pcs",
    hsn_code: "85171200",
    gst_rate: 18,
    low_stock_threshold: 5,
  },
  {
    name: 'Apple MacBook Pro 16" M3',
    sku: "MBP16-M3-512",
    description: "Professional laptop with M3 chip and 512GB SSD",
    category: "Electronics",
    price: 2499.99,
    stock_quantity: 12,
    unit: "pcs",
    hsn_code: "84713000",
    gst_rate: 18,
    low_stock_threshold: 3,
  },
  {
    name: "Dell XPS 13 Laptop",
    sku: "DXP13-256",
    description: "Ultrabook with 13-inch display and 256GB SSD",
    category: "Electronics",
    price: 1299.99,
    stock_quantity: 18,
    unit: "pcs",
    hsn_code: "84713000",
    gst_rate: 18,
    low_stock_threshold: 5,
  },
  {
    name: "Sony WH-1000XM5 Headphones",
    sku: "SONY-WH1000XM5",
    description: "Premium noise-canceling wireless headphones",
    category: "Audio",
    price: 399.99,
    stock_quantity: 30,
    unit: "pcs",
    hsn_code: "85183000",
    gst_rate: 18,
    low_stock_threshold: 8,
  },
  {
    name: "Logitech MX Master 3S Mouse",
    sku: "LOG-MX3S",
    description: "Wireless ergonomic mouse for productivity",
    category: "Accessories",
    price: 99.99,
    stock_quantity: 45,
    unit: "pcs",
    hsn_code: "84716000",
    gst_rate: 18,
    low_stock_threshold: 10,
  },
  {
    name: 'Samsung 4K Monitor 27"',
    sku: "SAM-4K27",
    description: "27-inch 4K UHD monitor with HDR support",
    category: "Monitors",
    price: 399.99,
    stock_quantity: 20,
    unit: "pcs",
    hsn_code: "85287100",
    gst_rate: 18,
    low_stock_threshold: 5,
  },
  {
    name: "Corsair Vengeance DDR4 32GB",
    sku: "COR-DDR4-32GB",
    description: "32GB DDR4 RAM kit for gaming and workstations",
    category: "Components",
    price: 149.99,
    stock_quantity: 35,
    unit: "kits",
    hsn_code: "84733000",
    gst_rate: 18,
    low_stock_threshold: 8,
  },
  {
    name: "NVIDIA RTX 4080 Graphics Card",
    sku: "NVD-RTX4080",
    description: "High-performance graphics card for gaming and AI",
    category: "Components",
    price: 1199.99,
    stock_quantity: 8,
    unit: "pcs",
    hsn_code: "84718000",
    gst_rate: 18,
    low_stock_threshold: 2,
  },
  {
    name: "Samsung 980 PRO 1TB SSD",
    sku: "SAM-980PRO-1TB",
    description: "High-speed NVMe SSD for storage upgrade",
    category: "Storage",
    price: 199.99,
    stock_quantity: 25,
    unit: "pcs",
    hsn_code: "84717000",
    gst_rate: 18,
    low_stock_threshold: 5,
  },
  {
    name: "Razer BlackWidow V4 Keyboard",
    sku: "RAZ-BW-V4",
    description: "Mechanical gaming keyboard with RGB lighting",
    category: "Accessories",
    price: 179.99,
    stock_quantity: 22,
    unit: "pcs",
    hsn_code: "84716000",
    gst_rate: 18,
    low_stock_threshold: 5,
  },
];

const productionUsers = [
  {
    username: "admin",
    email: "admin@company.com",
    password: "admin123",
    role: "admin",
    first_name: "System",
    last_name: "Administrator",
  },
  {
    username: "manager1",
    email: "manager1@company.com",
    password: "manager123",
    role: "manager",
    first_name: "John",
    last_name: "Manager",
  },
  {
    username: "employee1",
    email: "employee1@company.com",
    password: "employee123",
    role: "employee",
    first_name: "Jane",
    last_name: "Employee",
  },
];

async function clearAllData() {
  console.log("🧹 Clearing all existing data...");

  try {
    // Delete in correct order to respect foreign key constraints
    await pool.execute("DELETE FROM transactions");
    await pool.execute("DELETE FROM barcodes");
    await pool.execute("DELETE FROM inventory");
    await pool.execute("DELETE FROM alerts");
    await pool.execute("DELETE FROM products");
    await pool.execute('DELETE FROM users WHERE username != "admin"');

    console.log("✅ All data cleared successfully");
  } catch (error) {
    console.error("❌ Error clearing data:", error);
    throw error;
  }
}

async function insertProductionData() {
  console.log("📦 Inserting production data...");

  try {
    // Insert users
    console.log("👥 Creating users...");
    for (const user of productionUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await pool.execute(
        `INSERT INTO users (username, email, password_hash, role, first_name, last_name) 
         VALUES (?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
         email = VALUES(email), 
         password_hash = VALUES(password_hash), 
         role = VALUES(role), 
         first_name = VALUES(first_name), 
         last_name = VALUES(last_name)`,
        [
          user.username,
          user.email,
          hashedPassword,
          user.role,
          user.first_name,
          user.last_name,
        ]
      );
    }

    // Insert products
    console.log("📱 Creating products...");
    for (const product of productionProducts) {
      const [result] = await pool.execute(
        `INSERT INTO products (name, sku, description, category, price, stock_quantity, unit, hsn_code, gst_rate, low_stock_threshold) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
         name = VALUES(name), 
         description = VALUES(description), 
         category = VALUES(category), 
         price = VALUES(price), 
         stock_quantity = VALUES(stock_quantity), 
         unit = VALUES(unit), 
         hsn_code = VALUES(hsn_code), 
         gst_rate = VALUES(gst_rate), 
         low_stock_threshold = VALUES(low_stock_threshold)`,
        [
          product.name,
          product.sku,
          product.description,
          product.category,
          product.price,
          product.stock_quantity,
          product.unit,
          product.hsn_code,
          product.gst_rate,
          product.low_stock_threshold,
        ]
      );

      // Create inventory record
      await pool.execute(
        `INSERT INTO inventory (product_id, quantity) VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
        [result.insertId || product.sku, product.stock_quantity]
      );
    }

    // Generate some sample transactions
    console.log("📊 Creating sample transactions...");
    const [products] = await pool.execute(
      "SELECT id, name, sku FROM products LIMIT 5"
    );
    const [users] = await pool.execute("SELECT id FROM users LIMIT 3");

    const transactionTypes = ["in", "out"];
    const transactionCount = 20;

    for (let i = 0; i < transactionCount; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const user = users[Math.floor(Math.random() * users.length)];
      const type =
        transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
      const quantity = Math.floor(Math.random() * 10) + 1;
      const unitPrice = Math.floor(Math.random() * 1000) + 50;

      await pool.execute(
        `INSERT INTO transactions (type, product_id, quantity, unit_price, total_amount, user_id, reference_number, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          type,
          product.id,
          quantity,
          unitPrice,
          quantity * unitPrice,
          user.id,
          `REF-${Date.now()}-${i}`,
          `Sample ${type} transaction for ${product.name}`,
        ]
      );
    }

    console.log("✅ Production data inserted successfully");
  } catch (error) {
    console.error("❌ Error inserting production data:", error);
    throw error;
  }
}

async function showCurrentData() {
  console.log("📊 Current database status:");

  try {
    const [products] = await pool.execute(
      "SELECT COUNT(*) as count FROM products"
    );
    const [transactions] = await pool.execute(
      "SELECT COUNT(*) as count FROM transactions"
    );
    const [users] = await pool.execute("SELECT COUNT(*) as count FROM users");
    const [barcodes] = await pool.execute(
      "SELECT COUNT(*) as count FROM barcodes"
    );

    console.log(`📱 Products: ${products[0].count}`);
    console.log(`📊 Transactions: ${transactions[0].count}`);
    console.log(`👥 Users: ${users[0].count}`);
    console.log(`🏷️  Barcodes: ${barcodes[0].count}`);
  } catch (error) {
    console.error("❌ Error getting data status:", error);
  }
}

async function main() {
  const action = process.argv[2];

  try {
    switch (action) {
      case "clear":
        await clearAllData();
        break;
      case "seed":
        await insertProductionData();
        break;
      case "reset":
        await clearAllData();
        await insertProductionData();
        break;
      case "status":
        await showCurrentData();
        break;
      default:
        console.log("📋 Data Management Script");
        console.log("");
        console.log("Usage: node manage-data.js <action>");
        console.log("");
        console.log("Actions:");
        console.log("  clear   - Clear all data (except admin user)");
        console.log("  seed    - Add production data");
        console.log("  reset   - Clear all data and add production data");
        console.log("  status  - Show current data status");
        console.log("");
        console.log("Examples:");
        console.log("  node manage-data.js status");
        console.log("  node manage-data.js reset");
        break;
    }
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  clearAllData,
  insertProductionData,
  showCurrentData,
};
