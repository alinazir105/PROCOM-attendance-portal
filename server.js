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
const SPREADSHEET_ID = '1T4SgPawsMWdUkD22SvGbOKUsPQTiQOsBockfhfg9TOU';

const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}'),
    scopes: SCOPES
});

const sheets = google.sheets({ version: 'v4', auth });

// Function to get the latest attendance status for each participant
const getAttendanceStatus = async () => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A2:E', // Assuming your sheet has headers in row 1
        });

        const attendanceRows = response.data.values || [];
        const attendanceStatus = new Map();

        // Process rows in reverse to get the latest status
        for (let i = attendanceRows.length - 1; i >= 0; i--) {
            const row = attendanceRows[i];
            if (row.length >= 4) {
                const key = `${row[1]}-${row[2]}-${row[3]}`; // competition-leader-team
                const action = row[4] || 'MARKED';
                
                // Only set if we haven't seen this participant yet (since we're going backwards)
                if (!attendanceStatus.has(key)) {
                    attendanceStatus.set(key, action === 'MARKED');
                }
            }
        }

        return attendanceStatus;
    } catch (error) {
        console.error('Error fetching attendance status:', error);
        return new Map();
    }
};

// Modified function to load participants with current attendance status
const loadParticipants = async () => {
    const attendanceStatus = await getAttendanceStatus();
    let participants = [];

    sheetNames.forEach(sheet => {
        let data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);
        data.forEach(entry => {
            if (entry.isApproved === 'approved') {
                const key = `${entry['Competition Name']}-${entry['Leader Name']}-${entry['Team Name']}`;
                participants.push({
                    competition: entry['Competition Name'],
                    team: entry['Team Name'],
                    leader: entry['Leader Name'],
                    present: attendanceStatus.get(key) || false
                });
            }
        });
    });

    return participants;
};

// Modified route to get participants
app.get('/participants', async (req, res) => {
    try {
        const participants = await loadParticipants();
        res.json(participants);
    } catch (error) {
        console.error('Error loading participants:', error);
        res.status(500).json({ error: 'Failed to load participants' });
    }
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

// const appendToGoogleSheet = async (participant) => {
//     try {
//         // Add timestamp in a format Google Sheets can understand
//         const timestamp = new Date().toISOString();

//         const requestParams = {
//             spreadsheetId: SPREADSHEET_ID,
//             range: 'Sheet1!A2:D',
//             valueInputOption: 'RAW',
//             insertDataOption: 'INSERT_ROWS',
//             requestBody: {
//                 values: [
//                     [
//                         timestamp,                    // Time Stamp
//                         participant.competition,      // Competition
//                         participant.leader,           // Leader
//                         participant.team,            // Team
//                     ],
//                 ],
//             },
//         };

//         console.log("Attempting to append with data:", requestParams.requestBody.values[0]);

//         const response = await sheets.spreadsheets.values.append(requestParams);

//         if (response.data.updates) {
//             console.log(`Successfully updated ${response.data.updates.updatedRows} rows`);
//             return true;
//         }

//         return false;
//     } catch (error) {
//         console.error('Error in appendToGoogleSheet:', error);
//         if (error.response) {
//             console.error('Error details:', error.response.data);
//         }
//         throw error;
//     }
// };

// Add this new endpoint after your other routes
app.post('/remove-attendance', async (req, res) => {
  const { competition, leader, team } = req.body;
  participants = participants.map((p) =>
      p.team === team && p.competition === competition && p.leader === leader
          ? { ...p, present: false }
          : p
  );

  // Log the removal to Google Sheets
  const participant = participants.find(
      (p) => p.team === team && p.competition === competition && p.leader === leader
  );
  if (participant) {
      await appendToGoogleSheet({
          ...participant,
          action: 'REMOVED' // Adding action field to track removals
      });
  }

  res.json({ success: true });
});

// Modify the appendToGoogleSheet function to handle removals
const appendToGoogleSheet = async (participant) => {
  try {
      const timestamp = new Date().toISOString();

      const requestParams = {
          spreadsheetId: SPREADSHEET_ID,
          range: 'Sheet1!A2:E', // Added one more column for action
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
              values: [
                  [
                      timestamp,
                      participant.competition,
                      participant.leader,
                      participant.team,
                      participant.action || 'MARKED' // Default to MARKED for existing functionality
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