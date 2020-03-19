import * as functions from 'firebase-functions';
import fetch from 'node-fetch';
import { WebClient } from '@slack/web-api';
import { PubSub } from '@google-cloud/pubsub';

import { KnownBlock } from '@slack/types';

import * as util from './util';
import { Conversation, Partner, ProjectInfo } from './types';

const Client = new WebClient(functions.config().slack.token);
const PubSubClient = new PubSub();

const PROJECTS_YAML_URL = 'https://raw.githubusercontent.com/codeforboston/codeforboston.org/master/_data/projects/active.yml';
const PROJECTS_URL = 'https://www.codeforboston.org/projects/';


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

const fields: [keyof ProjectInfo, string, ((val: any) => string)][] = [
    ['technologies', 'Tech Stack', tech => tech],
    ['slackChannel', 'Channel', channel => `#${channel}`],
    ['repository', 'Repo', url => `<${url}>`],
];

function formatProject(project: ProjectInfo, detailed=false): KnownBlock {
    if (!detailed) {
        const pieces = [`*${project.name}*`];
        if (project.slackChannel)
            pieces.push(`Channel: #${project.slackChannel}`);
        if (project.repository)
            pieces.push(`Repo: <${project.repository}>`);
        return {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: pieces.join(' • ')
            }
        };
    }

    const desc = project.elevatorPitch || (project.partner && `A project in partnership with ${partnersList(project.partner)}`);
    return {
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: `*${project.name}*\n${desc}`,
        },
        fields: Array.prototype.concat.apply([], fields
                                             .filter(([key]) => !!project[key])
                                             .map(
                                                 ([key, name, fn]) => ([
                                                     {
                                                         type: 'mrkdwn',
                                                         text: `*${name}*`
                                                     },
                                                     {
                                                         type: 'mrkdwn',
                                                         text: fn(project[key])
                                                     }
                                                 ])
                                             ))
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
        text: `Welcome to the Code for Boston Slack! You can check <${PROJECTS_URL}|our website> for a list of active projects.`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `Welcome to the Code for Boston Slack! Here's a list of our active projects to help you get started. If you find one that interests you, hop in the channel and introduce yourself!`
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
    await fetch(command.response_url, {
        method: 'POST',
        headers: { 'Content-type': 'application/json' },
        body: JSON.stringify({
            blocks: await buildProjectsInfo({ detailed: true }),
            replace_original: true
        })
    });
}

export const handleMessage = functions.pubsub.topic('slack-message')
    .onPublish(async (message, context) => {
        const { event, command } = message.json;

        try {
            if (event) {
                console.log('received event', JSON.stringify(event));
                if (event.type === 'member_joined_channel') {
                    await memberJoined(event);
                }
            } else if (command) {
                console.log('received command', JSON.stringify(message.json));
                await projectsCommand(message.json);
            }
        } catch (err) {
            console.log(err?.data);
            throw err;
        }
    });

export const handleRequest = functions.https.onRequest(async (req, res) => {
    if (req.body.challenge) {
        console.log('responding to challenge');
        res.send({ challenge: req.body.challenge });
        return;
    }

    if (!util.verifySlackRequest(req, functions.config().slack?.signing_secret)) {
        console.warn('Got a bad request', JSON.stringify(req.body));
        res.status(403).send('Invalid signature');
        return;
    }

    await PubSubClient.topic('slack-message')
        .publish(Buffer.from(JSON.stringify(req.body)));

    res.sendStatus(200);
});