#!/usr/bin/env node

/**
 * Add Manager User Script
 * This script adds a new user with manager role to the database
 */

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

// Database configuration (same as server)
const config = {
  host: process.env.DB_HOST || "31.97.61.5",
  user: process.env.DB_USER || "wms",
  password: process.env.DB_PASSWORD || "Kalbazaar@177",
  database: process.env.DB_NAME || "wms_db",
  port: process.env.DB_PORT || 3306,
};

async function addManagerUser() {
  console.log("👤 Adding Manager User\n");

  let connection;

  try {
    console.log("1️⃣ Connecting to database...");
    connection = await mysql.createConnection(config);
    console.log("✅ Connected successfully!");

    // Check if users table exists
    console.log("\n2️⃣ Checking users table...");
    try {
      await connection.execute("SELECT 1 FROM users LIMIT 1");
      console.log("✅ Users table exists");
    } catch (error) {
      if (error.code === "ER_NO_SUCH_TABLE") {
        console.log(
          "❌ Users table doesn't exist. Please run the database setup first."
        );
        return;
      } else {
        throw error;
      }
    }

    // Check if manager user already exists
    console.log("\n3️⃣ Checking if manager user already exists...");
    const [existingUsers] = await connection.execute(
      "SELECT id, username, email, role FROM users WHERE username = ? OR email = ?",
      ["manager", "manager@wms.com"]
    );

    if (existingUsers.length > 0) {
      console.log("⚠️  Manager user already exists:");
      console.table(existingUsers);
      console.log("\n❌ Please choose a different username or email.");
      return;
    }

    // Get user details
    console.log("\n4️⃣ Enter manager user details:");

    // Default manager user details
    const managerUser = {
      username: "manager",
      email: "manager@wms.com",
      password: "manager123",
      role: "manager",
      first_name: "Manager",
      last_name: "User",
      phone: "+1234567890",
    };

    console.log("📝 Using default manager user details:");
    console.log(`   Username: ${managerUser.username}`);
    console.log(`   Email: ${managerUser.email}`);
    console.log(`   Password: ${managerUser.password}`);
    console.log(`   Role: ${managerUser.role}`);
    console.log(`   Name: ${managerUser.first_name} ${managerUser.last_name}`);

    // Hash password
    console.log("\n5️⃣ Hashing password...");
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(managerUser.password, saltRounds);
    console.log("✅ Password hashed successfully");

    // Insert manager user
    console.log("\n6️⃣ Inserting manager user...");
    await connection.execute(
      `INSERT INTO users (
        username, 
        email, 
        password_hash, 
        role, 
        first_name, 
        last_name, 
        phone,
        is_active, 
        created_at, 
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        managerUser.username,
        managerUser.email,
        passwordHash,
        managerUser.role,
        managerUser.first_name,
        managerUser.last_name,
        managerUser.phone,
        true,
      ]
    );
    console.log("✅ Manager user created successfully!");

    // Verify the user was created
    console.log("\n7️⃣ Verifying manager user...");
    const [newUser] = await connection.execute(
      "SELECT id, username, email, role, first_name, last_name, is_active, created_at FROM users WHERE username = ?",
      [managerUser.username]
    );

    if (newUser.length > 0) {
      console.log("✅ Manager user verified:");
      console.table(newUser);
    } else {
      console.log("❌ Failed to verify manager user creation");
    }

    // Show all users
    console.log("\n8️⃣ Current users in database:");
    const [allUsers] = await connection.execute(
      "SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at"
    );
    console.table(allUsers);

    console.log("\n🎉 Manager user added successfully!");
    console.log("📋 Login credentials:");
    console.log(`   Username: ${managerUser.username}`);
    console.log(`   Password: ${managerUser.password}`);
    console.log(`   Role: ${managerUser.role}`);
  } catch (error) {
    console.error("❌ Error adding manager user:", error.message);
    if (error.code === "ER_DUP_ENTRY") {
      console.log(
        "💡 The username or email already exists. Please choose different credentials."
      );
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log("\n🔌 Database connection closed");
    }
  }
}

// Run the script
if (require.main === module) {
  addManagerUser().catch(console.error);
}

module.exports = addManagerUser;
