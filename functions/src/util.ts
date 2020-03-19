import { createHmac } from 'crypto';
import fetch from 'node-fetch';
import tsscmp from 'tsscmp';
import { https, config } from 'firebase-functions';
import YAML from 'yaml';

import { ProjectInfo } from './types';

const SlackSigningSecret: string = config().slack?.signing_secret;


export function verifySlackRequest(req: https.Request, secret=SlackSigningSecret) {
    if (!secret) {
        console.error('slack.signing_secret is unset!');
        return false;
    }

    const parts = req.get('x-slack-signature')?.split('=');

    if (!parts) {
        console.error('Request is missing x-slack-signature header');
        return false;
    }

    const timestamp = req.get('x-slack-request-timestamp');

    if (Date.now()/1000 - Number(timestamp) > 60*5)
        return false;

    const hmac = createHmac('sha256', secret);
    hmac.update(`${parts[0]}:${timestamp}:${req.rawBody}`);

    return tsscmp(parts[1], hmac.digest('hex'));
}

export async function getProjects(url: string): Promise<ProjectInfo[]> {
    const response = await fetch(url);

    if (!response.ok)
        throw new Error(`Responded with status ${response.status}`);

    return YAML.parse(await response.text());
}
