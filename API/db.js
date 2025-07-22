const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config();

const poolPromise = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,

    ssl: {
        rejectUnauthorized: false  
    }

}).promise();

// Test database connection
const TestConnection = async () => {
    try {
        const [rows, fields] = await poolPromise.query("SELECT 1");  // Simple query to test connection
        if (rows && rows.length > 0) {
            console.log("Database connection successful!");
        } else {
            console.log("No data returned from the query");
        }
    } catch (err) {
        console.error("Database connection failed:", err);
    }
}

TestConnection();

module.exports = poolPromise;
