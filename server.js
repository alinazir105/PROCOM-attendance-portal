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
const CREDENTIALS_PATH = path.join(__dirname, '/attendance-portal-procom-fce6f8a37155.json');; // Path to your credentials JSON file

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
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Sheet1!A:D', // Adjust the range as per your sheet's columns
        valueInputOption: 'RAW',
        requestBody: {
          values: [
            [
              participant.competition,
              participant.leader,
              participant.team,
              participant.present ? 'Present' : 'Absent',
            ],
          ],
        },
      });
      console.log('Data appended successfully', response.data);
    } catch (error) {
      console.error('Error appending data to Google Sheets', error);
    }
  };
  

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
