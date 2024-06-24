const { Client, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const groupName = 'EM 2024 ⚽️';
const emojiToCountry = {
  "🇩🇪": "Germany",
  "🏴󠁧󠁢󠁳󠁣󠁴󠁿": "Scotland",
  "🇭🇺": "Hungary",
  "🇨🇭": "Switzerland",
  "🇪🇸": "Spain",
  "🇭🇷": "Croatia",
  "🇮🇹": "Italy",
  "🇦🇱": "Albania",
  "🇸🇮": "Slovenia",
  "🇩🇰": "Denmark",
  "🇷🇸": "Serbia",
  "🏴󠁧󠁢󠁥󠁮󠁧󠁿": "England",
  "🇵🇱": "Poland",
  "🇳🇱": "Netherlands",
  "🇦🇹": "Austria",
  "🇫🇷": "France",
  "🇧🇪": "Belgium",
  "🇸🇰": "Slovakia",
  "🇷🇴": "Romania",
  "🇺🇦": "Ukraine",
  "🇹🇷": "Turkey",
  "🇬🇪": "Georgia",
  "🇵🇹": "Portugal",
  "🇨🇿": "Czechia"
};
const numberToPerson = {
  '4915737856389': "Jan",
  '4915159093979': "Jasmin",
  '353861643662': "Patrick",
  '4915229531655': "Ute",
  '4917660192838': "Zoé",
};

function parseMessage(messageBody) {
  const matches = messageBody.split('\n');
  const countries = [];
  const scores = [];
  for (let match of matches) {
    const firstColonIndex = match.indexOf(':');
    const secondColonIndex = match.indexOf(':', firstColonIndex + 1);

    const emoji1 = match.substring(0, firstColonIndex).trim();
    const emoji2 = match.substring(firstColonIndex + 1, secondColonIndex).trim().split(' ')[0];

    const number1 = parseInt(match.substring(firstColonIndex + 1, secondColonIndex).trim().split(' ')[1]);
    const number2 = parseInt(match.substring(secondColonIndex + 1).trim());

    countries.push(`${emojiToCountry[emoji1]} - ${emojiToCountry[emoji2]}`);
    scores.push(`${number1}-${number2}`);
  }

  return [countries, scores];
}

// Helper function to find predictions
function findPredictions(messageBody, author) {
  const [countries, scores] = parseMessage(messageBody);
  const phoneNumber = author.replace('@c.us', '');
  const predictions = [];

  // remove all entries in countries that contain undefined
  for (let i = 0; i < countries.length; i++) {
    if (countries[i].includes('undefined')) {
      countries.splice(i, 1);
      scores.splice(i, 1);
    } else if (scores[i].includes('NaN')) {
      countries.splice(i, 1);
      scores.splice(i, 1);
    }
  }

  if (countries.length > 0) {
    console.log(`${numberToPerson[phoneNumber]} Predictions:`);
    console.log("Countries:", countries);
    console.log("Scores:", scores);

    for (let i = 0; i < countries.length; i++) {
      predictions.push({
        name: numberToPerson[phoneNumber],
        country: countries[i],
        score: scores[i]
      });
    }
  }

  return predictions;
}


// Initialize the client
const client = new Client({
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
});

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Client is ready!');

  // Replace with your group name or ID
  const groupName = 'EM 2024 ⚽️';

  client.getChats().then(chats => {
    const group = chats.find(chat => chat.isGroup && chat.name === groupName);
    if (group) {
      console.log(`Found group: ${group.name}`);
      const predictions = readGroupMessages(group);
      updateSheet(predictions).catch(console.error);
    } else {
      console.log('Group not found!');
    }
  }).catch(error => {
    console.error('Error fetching chats:', error);
  });
});

client.on('message', async message => {
  const chat = await message.getChat();
  if (chat.isGroup && chat.name === groupName) {
    const predictions = findPredictions(message.body, message.author);
    console.log(predictions);
    updateSheet(predictions).catch(console.error);
  }
});

// Read messages from the group
function readGroupMessages(group) {
  const predictions = [];
  group.fetchMessages({ limit: 10 }).then(messages => {
      messages.forEach(message => {
          const messagePredictions = findPredictions(message.body, message.author);
          predictions.push(...messagePredictions);
      });
  }).catch(error => {
      console.error('Error fetching messages:', error);
  });

  return predictions;
}

client.initialize().catch(error => {
  console.error('Client initialization error:', error);
});

const fs = require('fs');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const path = require('path');

// Load client secrets from a local file.
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Authenticate and create a sheets client
async function getAuthenticatedClient() {
  const auth = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const client = await auth.getClient();
  return client;
}

// Function to update Google Sheets
async function updateSheet(data) {
  const authClient = await getAuthenticatedClient();

  const spreadsheetId = '1iXjffNicE2s22MZsNOFDbwYQGmvm0BmE8i7t16gdudc';
  const sheetName = 'Sheet1'; // Change if your sheet has a different name

  const sheet = google.sheets({ version: 'v4', auth: authClient });

  // Get the sheet metadata to find the ranges
  const sheetMetadata = await sheet.spreadsheets.get({
    spreadsheetId,
  });

  const sheetInfo = sheetMetadata.data.sheets.find(s => s.properties.title === sheetName);
  const { gridProperties: { rowCount, columnCount } } = sheetInfo.properties;

  // Fetch the names from column B
  const nameRange = `B2:B${rowCount}`;
  const countryRange = `D1:${columnCount}`;

  const namesResult = await sheet.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${nameRange}`,
  });

  const countriesResult = await sheet.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${countryRange}`,
  });

  const names = namesResult.data.values ? namesResult.data.values.flat() : [];
  const countries = countriesResult.data.values ? countriesResult.data.values[0].slice(1) : [];

  const updates = [];

  data.forEach(item => {
    const rowIndex = names.indexOf(item.name) + 3;
    const columnIndex = countries.indexOf(item.country) + 5;

    if (rowIndex >= 2 && columnIndex >= 2) {
      const columnLetter = getColumnLetter(columnIndex); // Convert index to letter
      if (/^[A-Z]+$/.test(columnLetter) && /^[0-9]+$/.test(rowIndex.toString())) { // Validate
        const cellRange = `${sheetName}!${columnLetter}${rowIndex}`;
        updates.push({
          range: cellRange,
          values: [[item.score]],
        });
      } else {
        console.error(`Invalid range generated: ${sheetName}!${columnLetter}${rowIndex}`);
      }
    }
  });

  if (updates.length > 0) {
    await sheet.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });
  }
}

function getColumnLetter(index) {
  let column = "";
  let tempIndex = index;

  while (tempIndex > 0) {
    let remainder = (tempIndex - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    tempIndex = Math.floor((tempIndex - 1) / 26);
  }

  return column;
}
