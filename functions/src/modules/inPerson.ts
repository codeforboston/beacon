import fetch from 'node-fetch';
import { WebClient } from "@slack/web-api";
import { ModuleRegistry } from "../loader";

import { addNameToSheet, getSheetsService } from './sheets';


const SpreadsheetId = process.env.SHEET_ID;
const HackNightWeekday = 2;

function nextHackNight(d = new Date()) {
  const diff = (HackNightWeekday - d.getDay() + 7)%7;

  return new Date(d.getFullYear(), d.getMonth(), d.getDate()+diff);
}

const floorDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diffDays = (d1: Date, d2: Date) =>
  Math.floor((floorDate(d1).getTime() - floorDate(d2).getTime())/86400000);

const shortDateFormat = (d: Date) =>
  (d.getMonth()+1) + '/' + d.getDate();

async function postJSON(url: string, body: any) {
  console.log('posting', body);
  return await fetch(url, {
    method: 'POST',
    headers: { 'Content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const errorBlock = (text: string) => ({
  type: 'section',
  text: {
    type: 'mrkdwn',
    text
  }
});

const sheetUrl = (sheetId: string) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}`;

const sheetLink = (sheetId: string, text: string) =>
  `<${sheetUrl(sheetId)}|${text}>`;


async function tooLate(responseUrl: string) {
  await postJSON(responseUrl, {
    blocks: [
      errorBlock("Sorry, it's a little too late to sign up for this week's Hack Night! You can still join virtually.")
    ],
    response_type: 'ephemeral',
    replace_original: false,
  });
}

async function somethingWentWrong(responseUrl: string, sheetId: string) {

  await postJSON(responseUrl, {
    blocks: [
      errorBlock(`I wasn't able to add your name to the spreadsheet, so please ${sheetLink(sheetId, 'add it yourself')}.`),
    ],
    response_type: 'ephemeral',
    replace_original: false,
  });
}

async function checkIn(userId: string, responseUrl: string, client: WebClient) {
  const now = new Date();
  const d = nextHackNight(now);

  const diff = diffDays(now, d);
  if (diff === 0 || (diff === 1 && now.getHours() >= 17)) {
    // Error... Have to check in before
    await tooLate(responseUrl);
    return;
  }

  if (!SpreadsheetId)
    throw 'No spreadsheet id configured';

  // Proceed
  const userInfo = await client.users.info({ user: userId });
  if (!userInfo.ok) {
    throw '';
  }

  const { profile: { email, real_name }, name: username} = (userInfo.user as any);
  const service = await getSheetsService();
  try {
    await addNameToSheet({
      date: d,
      users: [{ name: real_name, email, username }],
      spreadsheetId: SpreadsheetId,
      sheets: service.spreadsheets,
    });

    const response = await postJSON(responseUrl, {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Great! Your name has been added to the ${sheetLink(SpreadsheetId, 'spreadsheet')} for ${shortDateFormat(d)}.`
          }
        }
      ],
      response_type: 'ephemeral',
      replace_original: false,
    });

    if (!response.ok) {
      console.error(
        'POST', responseUrl, '--', response.status,
        await response.text()
      );
    }
  } catch (e) {
    console.error(e);
    await somethingWentWrong(responseUrl, SpreadsheetId);
  }
}

export type SendInPersonReminderOptions = {
  client: WebClient,
  channel: string,
  date?: Date,
};
export async function sendReminder(options: SendInPersonReminderOptions) {
  const { client, channel, date = nextHackNight() } = options;

  const fmtDate = shortDateFormat(date);
  await client.chat.postMessage({
    channel,
    text: `Please add your name to the spreadsheet if you plan to attend the ${fmtDate} Hack Night *in person*.`,
    blocks: [
		  {
			  "type": "section",
			  "text": {
				  "type": "mrkdwn",
				  "text": `Will you attend the next Hack Night (${fmtDate}) *in person*?`
			  }
		  },
		  {
			  "type": "divider"
		  },
		  {
			  "type": "actions",
			  "elements": [
				  {
					  "type": "button",
					  "text": {
						  "type": "plain_text",
						  "text": "Add My Name"
					  },
					  "action_id": "in_person",
					  "value": "yes"
				  }
			  ]
		  }
	  ]
  });
}


export default function load(registry: ModuleRegistry) {
  registry.registerBlockAction('in_person', {
    async handler(event, action, { client }) {
      console.log('inPerson processing action:', action, 'from user', event.user.username)
      if (action.value.match(/yes/i)) {
        await checkIn(event.user.id, event.response_url, client);
      }
    }
  });

  registry.registerCommand('checkin', {
    async handler(event, { client }) {
      await checkIn(event.user_id, event.response_url, client);
    },
    ackMessage: 'Give me a second to add your name to the spreadsheet...',
  });
}
