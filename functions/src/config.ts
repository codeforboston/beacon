const DATA_URL = 'https://raw.githubusercontent.com/codeforboston/codeforboston.org/master/_data/projects/active.yml';
const PROJECTS_URL = 'https://www.codeforboston.org/projects/';


const {
  GITHUB_WEBHOOK_SECRET, SLACK_TOKEN, SLACK_SECRET, QUEUE_NAME
} = process.env;

export default {
  githubSecret: GITHUB_WEBHOOK_SECRET,
  slackToken: SLACK_TOKEN,
  slackSecret: SLACK_SECRET,
  queueName: QUEUE_NAME,
  dataURL: DATA_URL,
  websiteURL: PROJECTS_URL,
  descriptionField: 'elevatorPitch',
  summaryFields: [
    { key: 'slackChannel', name: 'Channel', format: '#{slackChannel}' },
    { key: 'repository', name: 'Repo', format: '<{repository}>' },
  ],
  detailedFields: [
    { key: 'technologies', name: 'Tech Stack' },
    { key: 'slackChannel', name: 'Channel', format: '#{slackChannel}' },
    { key: 'repository', name: 'Repo', format: '<{repository}>' },
  ],
  welcomeMessage: `Welcome to the Code for Boston Slack! Here's a list of our active projects to help you get started. If you find one that interests you, hop in the channel and introduce yourself!`,
  welcomePlainMessage:  `Welcome to the Code for Boston Slack! You can check <${PROJECTS_URL}|our website> for a list of active projects.`
};
