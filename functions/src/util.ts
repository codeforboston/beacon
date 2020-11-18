import { createHmac } from 'crypto';
import fetch from 'node-fetch';
import tsscmp from 'tsscmp';
import YAML from 'yaml';

import config from './config';
import { ProjectInfo } from './types';

const SlackSigningSecret = config.slackToken as string;


type HasHeaders = { headers: { [k in string]: string } };
type HasBody = { rawBody: string, body: any };
export type ReqLike = HasHeaders & HasBody;

export function getHeader(reqLike: HasHeaders, name: string) {
  const headers = reqLike.headers;
  if (headers[name])
    return headers[name];

  name = name.toLowerCase();
  for (let k in headers) {
    if (k.toLowerCase() === name)
      return headers[k];
  }

  return null;
}

export function verifySlackRequest(req: ReqLike, secret=SlackSigningSecret) {
  if (!secret) {
    console.error('slack.signing_secret is unset!');
    return false;
  }

  const parts = getHeader(req, 'x-slack-signature')?.split('=');

  if (!parts) {
    console.error('Request is missing x-slack-signature header');
    return false;
  }

  const timestamp = getHeader(req, 'x-slack-request-timestamp');

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



const format = (s: string, vars: any) => s.replace(/\{([\w._]+)\}/g, (_, n) => vars[n]);

type Formatter = (data: any) => string;

export function makeFormatter(input: string | Formatter): Formatter {
  if (typeof input === 'function')
    return input;

  return (data) => format(input, data);
}

export const decamel = (s: string) => s.replace(/([^A-Z])([A-Z])/gu, '$1 $2');

type FieldConfig = { key: string, name?: string, format?: string|Formatter };
export const prepFields = (fields: FieldConfig[]) => fields.map(field => ({
  ...field,
  format: field.format ? makeFormatter(field.format) : ((d: any) => `${d[field.key]}`),
  name: field.name || decamel(field.key)
}));

export function parseFormBody(body: string): any {
  return body.split('&').reduce((m, pair) => {
    const [k, v] = pair.split('=');
    m[decodeURIComponent(k)] = decodeURIComponent(v);
    return m;
  }, {} as any);
}

export function parseBody(req: HasHeaders & { body: string }): any {
  const contentType = getHeader(req, 'Content-Type');

  if (contentType?.startsWith('application/json')) {
    return JSON.parse(req.body);
  }

  if (contentType?.startsWith('application/x-www-form-urlencoded')) {
    return parseFormBody(req.body);
  }

  return req.body;
}
