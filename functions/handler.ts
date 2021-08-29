import { APIGatewayEvent } from './src/types';

import * as beacon from './src';
import * as $u from './src/util';

export const handleQueue = async (event: any, _context: any) => {
  console.log('event', event);
  for (const record of event.Records) {
    if (record.attributes.MessageGroupId === 'slack-queue') {
      await beacon.handleSlackMessage(JSON.parse(record.body));
    }
  }
};

export const handleWebhook = (event: APIGatewayEvent, context: any) => {
  const [,,, region, accountId] = context.invokedFunctionArn.split(':');
  const queueName = process.env['QUEUE_NAME'];
  const queueUrl = `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
  const body = $u.parseBody(event);
  console.log('event body:', body);

  const req = {
    body,
    rawBody: event.body,
    headers: event.headers,
  };

  return beacon.handleRequest(req, queueUrl);
};

export const handleInPersonReminder = async (_event: any, _context: any) => {
  await require('./src/modules/inPerson').sendReminder({
    client: beacon.Client,
    channel: process.env['CHECKINS_CHANNEL'] || 'beacon-test',
  });
}
