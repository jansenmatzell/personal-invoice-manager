const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Create a database connection
const createConnection = () => {
  // Ensure app data directory exists
  const appDataPath = path.join(app.getPath('userData'), 'database');
  console.log('Database directory path:', appDataPath);
  
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
    console.log('Created database directory');
  }
  
  const dbPath = path.join(appDataPath, 'invoices.db');
  console.log('Database file path:', dbPath);
  
  // Create a new database connection with better-sqlite3
  try {
    const db = new Database(dbPath, { 
      verbose: process.env.NODE_ENV === 'development' ? console.log : null 
    });
    console.log('Connected to the SQLite database');
    return db;
  } catch (error) {
    console.error('Error opening database:', error.message);
    throw error;
  }
};

// Initialize the database schema
const initDatabase = async () => {
  const db = createConnection();
  
  try {
    // Read schema from file
    const schemaPath = path.join(__dirname, 'database_schema.sql');
    console.log('Schema file path:', schemaPath);
    
    if (!fs.existsSync(schemaPath)) {
      console.error('Schema file does not exist!');
      throw new Error('Schema file not found');
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('Schema loaded');
    
    // Execute the schema
    db.exec(schema);
    console.log('Database schema initialized successfully');
    
    // Add wrapper methods to match the previous API but using better-sqlite3
    db.getAsync = (sql, params = []) => {
      try {
        return db.prepare(sql).get(...(Array.isArray(params) ? params : [params]));
      } catch (error) {
        console.error('getAsync error:', error.message);
        throw error;
      }
    };
    
    db.allAsync = (sql, params = []) => {
      try {
        return db.prepare(sql).all(...(Array.isArray(params) ? params : [params]));
      } catch (error) {
        console.error('allAsync error:', error.message);
        throw error;
      }
    };
    
    db.runAsync = (sql, params = []) => {
      try {
        const statement = db.prepare(sql);
        const result = statement.run(...(Array.isArray(params) ? params : [params]));
        return { 
          lastID: result.lastInsertRowid, 
          changes: result.changes 
        };
      } catch (error) {
        console.error('runAsync error:', error.message);
        throw error;
      }
    };
    
    db.execAsync = (sql) => {
      try {
        db.exec(sql);
        return Promise.resolve();
      } catch (error) {
        console.error('execAsync error:', error.message);
        throw error;
      }
    };
    
    // Verify tables were created
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Created tables:', tables.map(t => t.name).join(', '));
    
    return db;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

module.exports = { initDatabase };