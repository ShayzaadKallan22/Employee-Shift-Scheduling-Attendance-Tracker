const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config();

const poolPromise = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: 14901,
    waitForConnections: true,
    connectionLimit: 10,      // Max number of concurrent connections
    queueLimit: 0,            // Unlimited queue
}).promise();


// Test database connection
const TestConnection = async () => {
    try {
        console.time("DB Connection Test");
        const [rows, fields] = await poolPromise.query("SELECT 1");
        console.timeEnd("DB Connection Test");

        if (rows && rows.length > 0) {
            console.log("Database connection successful!");
        } else {
            console.log("No data returned from the query");
        }
    } catch (err) {
        console.error("Database connection failed:", err);
    }
};


TestConnection();

module.exports = poolPromise;
