import fetch from 'node-fetch';
import { WebClient } from '@slack/web-api';
import AWS from 'aws-sdk';

import { KnownBlock, SectionBlock } from '@slack/types';

import * as util from './util';
import { Conversation, Partner, ProjectInfo } from './types';

import config from './config';

const Client = new WebClient(config.slackToken);

const PROJECTS_YAML_URL = config.dataURL;
// const PROJECTS_URL = config.websiteURL;


const SQS = new AWS.SQS({ apiVersion: '2012-11-05' });


const Projects: {[k in string]: Promise<ProjectInfo[]>} = {};
async function getProjects(url = PROJECTS_YAML_URL) {
  if (!Projects[url])
    Projects[url] = util.getProjects(url);
  return await Projects[url];
}

async function getProjectsMap() {
  return getProjects().then(ps => new Map(ps.map(p => ([p.slackChannel, p]))));
}

// const DataViews = {
//     projects: {
//         yaml: PROJECTS_YAML_URL,
//         url: PROJECTS_URL
//     },
//     inactive: {
//         yaml: 'https://raw.githubusercontent.com/codeforboston/codeforboston.org/master/_data/projects/inactive.yml',
//         url: PROJECTS_URL
//     },
//     jobs: {
//
//     }
// };

// Some Slack types
interface MemberJoinedEvent {
  type: "member_joined_channel",
  user: string,
  channel: string,
  channel_type: string,
  team: string,
  inviter: string,
}

interface CommandEvent {
  command: string,
  text: string,
  response_url: string,
  trigger_id: string,
  user_id: string,
  team_id: string,
  channel_id: string,

  user_name: string,
}

function partnersList(partners: Partner[]) {
  return partners.map(p => p.url ? `<${p.url}|${p.name}>` : p.name).join(', ');
}

const SummaryFields = util.prepFields(config.summaryFields);
const DetailedFields = util.prepFields(config.detailedFields);

function formatProject(project: any, detailed=false): KnownBlock {
  if (!detailed) {
    const pieces = [`*${project.name}*`];

    for (const {key, name, format} of SummaryFields) {
      if (project[key])
        pieces.push(`${name || util.decamel(key)}: ${format(project[key])}`);
    }
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: pieces.join(' • ')
      }
    };
  }

  const desc = project[config.descriptionField || 'description'] ||
    (project.partner && `A project in partnership with ${partnersList(project.partner)}`);

  const fields: SectionBlock['fields'] = [];

  for (const {key, name, format} of DetailedFields) {
    if (!project[key]) continue;
    fields.push(
      {
        type: 'mrkdwn',
        text: `*${name}*`
      },
      {
        type: 'mrkdwn',
        text: format(project)
      }
    )
  }

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${project.name}*\n${desc}`,
    },
    fields
  };
}

async function buildProjectsInfo(options: { detailed?: boolean, url?: string }={}) {
  const { url, detailed } = Object.assign({ detailed: false, url: PROJECTS_YAML_URL }, options);
  const projects = await getProjects(url);
  const blocks: KnownBlock[] = [];
  projects.forEach((proj, i) => {
    if (!i || detailed)
      blocks.push({ type: 'divider' });
    blocks.push(formatProject(proj, detailed));
  });
  return blocks;
}

async function postProjectsInfo(user: string, channel: string, detailed=false) {
  const blocks = await buildProjectsInfo({ detailed });

  await Client.chat.postEphemeral({
    user,
    channel,
    text: config.welcomePlainMessage,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: config.welcomeMessage
        }
      },
      ...blocks,
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'To see additional details about the projects, type `/projects`'
          }
        ]
      }
    ]
  });
}

async function postProjectChannelWelcome(user: string, channel: Conversation, project: ProjectInfo) {
  const blocks: KnownBlock[] = [];
  const welcome = project.welcome || project.elevatorPitch;

  if (!project.welcome) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Welcome to ${project.name}!`
      }
    });
  }

  if (welcome) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: welcome
      }
    });
  }

  if (!project.welcome) {
    if (project.repository)
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Repository:* <${project.repository}>`
        }
      });
  }

  await Client.chat.postEphemeral({
    user,
    channel: channel.id,
    text: welcome || '',
    blocks
  });
}

async function memberJoined(event: MemberJoinedEvent) {
  const [response, projects] = await Promise.all([
    Client.conversations.info({ channel: event.channel }),
    getProjectsMap()
  ]);
  if (!response.ok)
    throw new Error(response.error);

  // If the member joined a project channel, send a channel-specific greeting
  const channel: Conversation = response.channel as any;
  const project = projects.get(channel.name) || projects.get(channel.name_normalized);
  console.info(`Looked up project info for channel: ${channel.name}:`, project);
  if (project) {
    await postProjectChannelWelcome(event.user, channel, project);
    return;
  }

  // Otherwise, send information about all projects
  await postProjectsInfo(event.user, event.channel);
}

async function projectsCommand(command: CommandEvent) {
  console.log('command:', command);
  await fetch(command.response_url, {
    method: 'POST',
    headers: { 'Content-type': 'application/json' },
    body: JSON.stringify({
      blocks: await buildProjectsInfo({ detailed: true }),
      replace_original: true
    })
  });
}

export const handleMessage = (async (message: any) => {
  const { event } = message;
  try {
    if (event) {
      console.log('received event', JSON.stringify(event));
      if (event.type === 'member_joined_channel') {
        await memberJoined(event);
      }
    } else if (message.command) {
      await projectsCommand(message);
    }
  } catch (err) {
    console.log(err?.data);
    throw err;
  }
  });

export const handleRequest = async (req: util.ReqLike, queueURL: string) => {
  if (req.body.challenge) {
    console.log('responding to challenge');
    return {
      statusCode: 200,
      headers: { 'Content-type': 'application/json' },
      body: JSON.stringify({ challenge: req.body.challenge })
    };
  }

  if (!util.verifySlackRequest(req, config.slackSecret)) {
    console.warn('Got a bad request', JSON.stringify(req.body));
    return {
      statusCode: 403,
      body: 'Invalid signature'
    };
  }

  await SQS.sendMessage({
    QueueUrl: queueURL,
    MessageBody: JSON.stringify(req.body),
    MessageAttributes: {
      topic: {
        DataType: 'String',
        StringValue: 'slack-message'
      }
    },
    MessageGroupId: 'slack-queue'
  }).promise();

  return { statusCode: 201 };
};
