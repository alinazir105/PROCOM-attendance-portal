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

// Initialize auth with environment variables
const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}'),
    scopes: SCOPES
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
// app.post('/mark-attendance', async (req, res) => {
//     const { competition, leader, team } = req.body;
//     participants = participants.map((p) =>
//         p.team === team && p.competition === competition && p.leader === leader
//             ? { ...p, present: true }
//             : p
//     );

//     // Append to Google Sheets after updating the attendance
//     const participant = participants.find(
//         (p) => p.team === team && p.competition === competition && p.leader === leader
//     );
//     if (participant) {
//         await appendToGoogleSheet(participant);
//     }

//     res.json({ success: true });
// });

// // API to remove attendance
// app.post('/remove-attendance', async (req, res) => {
//   const { competition, leader, team } = req.body;

//   // Remove the participant from the list by setting their "present" status to false
//   participants = participants.map((p) =>
//       p.team === team && p.competition === competition && p.leader === leader
//           ? { ...p, present: false }
//           : p
//   );

//   // Append to Google Sheets after updating the attendance
//   const participant = participants.find(
//       (p) => p.team === team && p.competition === competition && p.leader === leader
//   );
//   if (participant) {
//       await appendToGoogleSheet(participant);
//   }

//   res.json({ success: true });
// });


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
// API to mark attendance
app.post('/mark-attendance', async (req, res) => {
  const { competition, leader, team } = req.body;
  participants = participants.map((p) =>
      p.team === team && p.competition === competition && p.leader === leader
          ? { ...p, present: true }
          : p
  );

  const participant = participants.find(
      (p) => p.team === team && p.competition === competition && p.leader === leader
  );
  if (participant) {
      await updateGoogleSheet(participant);  // Update Google Sheet
  }

  res.json({ success: true });
});

// API to remove attendance
app.post('/remove-attendance', async (req, res) => {
  const { competition, leader, team } = req.body;
  participants = participants.map((p) =>
      p.team === team && p.competition === competition && p.leader === leader
          ? { ...p, present: false }
          : p
  );

  const participant = participants.find(
      (p) => p.team === team && p.competition === competition && p.leader === leader
  );
  if (participant) {
      await updateGoogleSheet(participant);  // Update Google Sheet
  }

  res.json({ success: true });
});

// Function to update Google Sheets (instead of appending)
const updateGoogleSheet = async (participant) => {
  try {
      const timestamp = new Date().toISOString();

      // Define the range to look for the row
      const range = 'Sheet1!A2:D';  // Adjust to match the correct range
      console.log('Searching for participant:', participant);

      // Retrieve current data from the sheet
      const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: range,
      });

      const rows = response.data.values || [];
      console.log('Current rows in sheet:', rows);

      // Find the row index based on the participant's details
      const rowIndex = rows.findIndex(row =>
          row[1] === participant.competition && row[2] === participant.leader && row[3] === participant.team
      );

      if (rowIndex !== -1) {
          const rowToUpdate = rowIndex + 2;  // Account for header row in the sheet
          console.log(`Found participant at row ${rowToUpdate}, updating attendance.`);

          const updateRequestParams = {
              spreadsheetId: SPREADSHEET_ID,
              range: `Sheet1!A${rowToUpdate}:D${rowToUpdate}`,
              valueInputOption: 'RAW',
              requestBody: {
                  values: [
                      [
                          timestamp,                    // Time Stamp
                          participant.competition,      // Competition
                          participant.leader,           // Leader
                          participant.team,             // Team
                      ],
                  ],
              },
          };

          const updateResponse = await sheets.spreadsheets.values.update(updateRequestParams);
          console.log('Update response:', updateResponse);
      } else {
          console.log('Participant not found in Google Sheets.');
      }
  } catch (error) {
      console.error('Error updating Google Sheet:', error);
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