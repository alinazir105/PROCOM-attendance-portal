import express from 'express';
import cors from 'cors';
import multer from 'multer';
import xlsx from 'xlsx';
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Load the Excel file
const filePath = './All_registrations.xlsx';
let workbook = xlsx.readFile(filePath);
let sheetNames = workbook.SheetNames;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Set up Google Sheets API
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = '1T4SgPawsMWdUkD22SvGbOKUsPQTiQOsBockfhfg9TOU'; // Replace with your Google Sheet ID
const CREDENTIALS_PATH = path.resolve(__dirname, 'attendance-portal-procom-4cbfede5d586.json'); // Path to your credentials JSON file

console.log("Checking credentials file...");
if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Credentials file not found at: ${CREDENTIALS_PATH}`);
}

try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    console.log("Credentials file loaded successfully");
    // Check if required fields exist
    if (!credentials.client_email || !credentials.private_key) {
        throw new Error('Credentials file is missing required fields');
    }
} catch (error) {
    console.error("Error loading credentials:", error);
    process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: SCOPES,
});

const sheets = google.sheets({ version: 'v4', auth });

// Extract data from all sheets
let participants = [];
sheetNames.forEach(sheet => {
    let data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);
    data.forEach(entry => {
        if (entry.isApproved === 'approved') {
            participants.push({
                competition: entry['Competition Name'],
                team: entry['Team Name'],
                leader: entry['Leader Name'],
                present: false
            });
        }
    });
});

// API to get participant data
app.get('/participants', (req, res) => {
    res.json(participants);
});

// API to mark attendance
app.post('/mark-attendance', async (req, res) => {
    const { competition, leader, team } = req.body;
    participants = participants.map((p) =>
      p.team === team && p.competition === competition && p.leader === leader
        ? { ...p, present: true }
        : p
    );
  
    // Append to Google Sheets after updating the attendance
    const participant = participants.find(
      (p) => p.team === team && p.competition === competition && p.leader === leader
    );
    if (participant) {
      await appendToGoogleSheet(participant);
    }
  
    res.json({ success: true });
  });
  
  const appendToGoogleSheet = async (participant) => {
    try {
        // Add timestamp in a format Google Sheets can understand
        const timestamp = new Date().toISOString();
        
        const requestParams = {
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A2:D',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [
                    [
                        timestamp,                    // Time Stamp
                        participant.competition,      // Competition
                        participant.leader,           // Leader
                        participant.team,            // Team
                    ],
                ],
            },
        };

        console.log("Attempting to append with data:", requestParams.requestBody.values[0]);
        
        const response = await sheets.spreadsheets.values.append(requestParams);
        
        if (response.data.updates) {
            console.log(`Successfully updated ${response.data.updates.updatedRows} rows`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error in appendToGoogleSheet:', error);
        if (error.response) {
            console.error('Error details:', error.response.data);
        }
        throw error;
    }
};

app.get('/test-sheets', async (req, res) => {
    try {
        // First test if auth is working
        const client = await auth.getClient();
        console.log("Auth client obtained successfully");

        // Then test if we can read the sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Attendance-Sheet!A1:D1',
        });
        
        console.log("Sheet response:", response.data);
        res.json({ 
            success: true, 
            headers: response.data.values[0],
            auth: "Successfully authenticated"
        });
    } catch (error) {
        console.error("Full error:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.response?.data || 'No additional details'
        });
    }
});

// API to export attendance to a new spreadsheet
app.get('/export', (req, res) => {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(participants);
    xlsx.utils.book_append_sheet(wb, ws, 'Attendance');
    const outputPath = './Attendance.xlsx';
    xlsx.writeFile(wb, outputPath);
    res.download(outputPath);
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
