import * as fs from 'fs';
import * as path from 'path';

import { google, sheets_v4 } from 'googleapis';

const SpreadsheetId = process.env.SPREADSHEET_ID;


if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const { LAMBDA_TASK_ROOT: rootDir = path.join(__dirname, '../..') } = process.env;
  const googleCredentials = path.join(rootDir, './service-account.json');
  if (fs.existsSync(googleCredentials))
    process.env.GOOGLE_APPLICATION_CREDENTIALS = googleCredentials;
  else
    console.warn('No credentials file found at', googleCredentials);
}

export async function getSheetsService() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({
    version: 'v4', auth: await auth.getClient()
  });
}

export function matchDate (date: Date) {
  const m = date.getMonth()+1;
  const d = date.getDate();
  const fy = ''+date.getFullYear();

  const re = new RegExp(`0*${m}[-/]0*${d}[-/](${fy.slice(0, 2)})?${fy.slice(-2)}`);

  return (title?: string | null) => (!!title?.match(re));
};

export const sheetNameForDate = (date: Date) =>
  [(''+(date.getMonth()+1)).padStart(2, '0'),
   (''+date.getDate()).padStart(2, '0'),
   (''+date.getFullYear()).slice(2)
  ].join('-');

const sheetIdForDate = (date: Date) =>
  ((date.getFullYear() * 10000) + (date.getMonth() * 100) + date.getDate());

const stringCell = (s: string) => ({
  userEnteredValue: { stringValue: s },
});

const boldCell = (s: string) => (
  {
    userEnteredValue: { stringValue: s },
    textFormatRuns: [
      { startIndex: 0,
        format: { bold: true } }
    ]
  });

function findSheet(sheets: sheets_v4.Schema$Sheet[] | undefined,
                   date: Date) {
  const matcher = matchDate(date);
  return sheets?.find(s => matcher(s.properties?.title))
}

export type UserInfo = { name: string, email?: string, username?: string, };
export type AddNameToSheetOptions = {
  spreadsheetId: string,
  date: Date,
  users: UserInfo[],
  sheets: sheets_v4.Resource$Spreadsheets,
};

export async function addNameToSheet(options: AddNameToSheetOptions) {
  const { spreadsheetId, date, users, sheets } = options;
  const ss = await sheets.get({ spreadsheetId });

  const sheet = findSheet(ss.data.sheets, date);
  const requests: sheets_v4.Schema$Request[] = [];
  let sheetId = sheet?.properties?.sheetId;

  if (!sheetId) {
    sheetId = sheetIdForDate(date);

    requests.push({
      addSheet: {
        properties: {
          title: sheetNameForDate(date),
          index: 0,
          sheetId,
        }
      }
    }, {
      appendCells: {
        sheetId,
        fields: '*',
        rows: [
          {
            values: [boldCell('Name'), boldCell('Email')]
          }
        ]
      }
    });
  }

  requests.push({
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: 'COLUMNS',
        startIndex: 0,
        endIndex: 1,
      },
      properties: {
        pixelSize: 150,
      },
      fields: 'pixelSize',
    }
  }, {
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: 'COLUMNS',
        startIndex: 1,
        endIndex: 2,
      },
      properties: {
        pixelSize: 200,
      },
      fields: 'pixelSize',
    }
  });

  requests.push({
    appendCells: {
      sheetId,
      fields: '*',
      rows: users.map(u => ({
        values: [stringCell(u.name), stringCell(u.email || ''), stringCell(u.username || '')]
      }))
    }
  }, {
    deleteDuplicates: {
      range: {
        sheetId,
        startRowIndex: 1,
      },
      // comparisonColumns: [
      //   {
      //   }
      // ]
    }
  });

  return await sheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests
    }
  });
}

async function main() {
  const service = await getSheetsService();

  if (!SpreadsheetId)
    throw 'no spreadsheet id found';

  return await addNameToSheet({
    spreadsheetId: SpreadsheetId,
    sheets: service.spreadsheets,
    date: new Date(),
    users: [
      { name: 'Joe' },
      { name: 'Brian', email: 'bds@example.com' },
    ]
  });
}

if (require.main === module)
  main();
