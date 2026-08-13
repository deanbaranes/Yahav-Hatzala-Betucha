const xlsx = require('xlsx');
const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
    try {
        const filePath = path.join('C:', 'Users', 'user', 'Desktop', 'Yahav Hatzala Betucha', 'טבלת לקוחות יהב.xlsx');
        if (!fs.existsSync(filePath)) {
            console.error("File not found:", filePath);
            return;
        }

        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const data = xlsx.utils.sheet_to_json(sheet);
        console.log("Total rows:", data.length);
        if (data.length > 0) {
            console.log("First row columns:", Object.keys(data[0]));
            console.log("First row data:", data[0]);
        }

        // Connect to DB
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        
        await client.connect();
        console.log("Connected to database successfully.");
        
        // Define mapping dynamically based on common header names
        // Let's first just print and we will run this script to inspect.
        
        await client.end();
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
