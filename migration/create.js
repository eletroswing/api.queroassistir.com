import pg from 'pg'
import dotenv from "dotenv";
if (process.env.NODE != "PRODUCTION") {
  dotenv.config();
}

// Configure a pool to connect to your PostgreSQL database
const pool = new pg.Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  password: process.env.PG_PASS,
  port: process.env.PG_PORT,
});

// SQL statement to create the table
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS logs  (
    id VARCHAR(100) PRIMARY KEY,
    route VARCHAR(350) NOT NULL,
    ip VARCHAR(40) NOT NULL,
    agent VARCHAR(250),
    moment TIMESTAMP NOT NULL
  )
`;

// Connect to the database and create the table
pool.connect((err, client, done) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    client.query(createTableQuery, (err, result) => {
      done(); // Release the client back to the pool

      if (err) {
        console.error('Error creating the table:', err);
      } else {
        console.log('Table "logs" created successfully.');
      }

      // Close the connection pool
      pool.end();
    });
  }
});