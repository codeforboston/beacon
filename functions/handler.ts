import { APIGatewayEvent } from './src/types';

import * as beacon from './src';
import * as $u from './src/util';

export const handleSlackMessage = async (event: any, _context: any) => {
  console.log('event', event);
  for (const record of event.Records) {
    await beacon.handleMessage(JSON.parse(record.body));
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
