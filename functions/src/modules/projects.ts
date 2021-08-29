import fetch from 'node-fetch';

import { KnownBlock, SectionBlock } from '@slack/types';
import { WebClient } from '@slack/web-api';

import { CommandEvent, ModuleRegistry } from '../loader';
import { Partner, ProjectInfo } from '../types';
import config from '../config';
import * as util from '../util';


const PROJECTS_YAML_URL = config.dataURL;
const Client = new WebClient(config.slackToken);


function partnersList(partners: Partner[]) {
  return partners.map(p => p.url ? `<${p.url}|${p.name}>` : p.name).join(', ');
}

type ProjectFields = { name: string, format: util.Formatter<ProjectInfo>, key: keyof ProjectInfo }[];

const SummaryFields = util.prepFields(config.summaryFields) as ProjectFields;
const DetailedFields = util.prepFields(config.detailedFields) as ProjectFields;


const Projects: {[k in string]: Promise<ProjectInfo[]>} = {};
async function getProjects(url = PROJECTS_YAML_URL) {
  if (!Projects[url])
    Projects[url] = util.getProjects(url);
  return await Projects[url];
}

export async function getProjectsMap() {
  return getProjects().then(ps => new Map(ps.map(p => ([p.slackChannel, p]))));
}
function formatProject(project: ProjectInfo, detailed=false): KnownBlock {
  if (!detailed) {
    const pieces = [`*${project.name}*`];

    for (const {key, name, format} of SummaryFields) {
      if (project[key])
        pieces.push(`${name || util.decamel(key)}: ${format(project)}`);
    }
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: pieces.join(' • ')
      }
    };
  }

  const desc = project[(config.descriptionField as keyof ProjectInfo) || 'description'] ||
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

export async function postProjectsInfo(user: string, channel: string, detailed=false) {
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

export async function projectsCommand(command: CommandEvent) {
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

export default function load(registry: ModuleRegistry) {
  registry.registerCommand('projects', {
    handler: projectsCommand,
    ackMessage: 'Loading project list...'
  });
}
