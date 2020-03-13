import { createHmac } from 'crypto';
import tsscmp from 'tsscmp';
import { https, config } from 'firebase-functions';


const SigningSecret: string = config().slack?.signing_secret;

export function verifySlackRequest(req: https.Request, secret = SigningSecret) {
    if (!secret) {
        console.error('slack.signing_secret is unset!');
        return false;
    }

    const parts = req.headers['x-slack-signature']?.toString().split('=');

    if (!parts) {
        console.error('Request is missing x-slack-signature header');
        return false;
    }

    const timestamp = req.headers['x-slack-request-timestamp'];

    if (Date.now()/1000 - Number(timestamp) > 60*5)
        return false;

    const hmac = createHmac('sha256', secret);
    hmac.update(`${parts[0]}:${timestamp}:${req.rawBody}`);

    return tsscmp(parts[1], hmac.digest('hex'));
}
