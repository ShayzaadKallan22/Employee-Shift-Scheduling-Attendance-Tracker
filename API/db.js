const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config();

const poolPromise = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+02:00', // Add this line to set the timezone
    dateStrings: true // Optional: prevents automatic conversion to JS Date objects
}).promise();

// Test database connection with timezone verification
const TestConnection = async () => {
    try {
        console.time("DB Connection Test");
        
        // First test basic connection
        const [rows] = await poolPromise.query("SELECT 1");
        
        // Then verify timezone
        const [timeResult] = await poolPromise.query(
            "SELECT @@global.time_zone, @@session.time_zone, NOW() as current_time"
        );
        
        console.timeEnd("DB Connection Test");

        if (rows && rows.length > 0) {
            console.log("Database connection successful!");
            console.log("Time zone settings:", {
                global: timeResult[0]['@@global.time_zone'],
                session: timeResult[0]['@@session.time_zone'],
                currentTime: timeResult[0].current_time
            });
        } else {
            console.log("No data returned from the query");
        }
    } catch (err) {
        console.error("Database connection failed:", err);
    }
};

TestConnection();

module.exports = poolPromise;