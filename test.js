const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const axios = require('axios');
const cron = require('node-cron');

// If modifying these SCOPES, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Sheets API.
  authorize(JSON.parse(content), fetchTeamsAndScheduleTasks);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Fetch teams from Google Sheets and schedule tasks.
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function fetchTeamsAndScheduleTasks(auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = 'YOUR_SPREADSHEET_ID'; // Replace with your Google Spreadsheet ID
  const range = 'Sheet1!A1:C1'; // Adjust the range according to your spreadsheet structure

  sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const rows = res.data.values;
    if (rows.length) {
      const [team1, team2, team3] = rows[0];
      console.log(`Teams fetched: 4pm: ${team1}, 7pm: ${team2}, 10pm: ${team3}`);
      scheduleTask('0 16 * * *', team1); // 4pm
      scheduleTask('0 19 * * *', team2); // 7pm
      scheduleTask('0 22 * * *', team3); // 10pm
    } else {
      console.log('No data found.');
    }
  });
}

/**
 * Schedule a task to fetch match results.
 * @param {string} cronTime The cron time string.
 * @param {string} team The team name.
 */
function scheduleTask(cronTime, team) {
  cron.schedule(cronTime, () => {
    fetchMatchResult(team);
  });
}

/**
 * Fetch match result from a web source.
 * @param {string} team The team name.
 */
async function fetchMatchResult(team) {
  try {
    const response = await axios.get(`YOUR_API_OR_WEB_SOURCE_URL/${team}`);
    // Assume the API response has the structure { data: { result: 'Score or Result' } }
    console.log(`Match result for ${team}:`, response.data.result);
  } catch (error) {
    console.error(`Error fetching result for ${team}:`, error);
  }
}
