## AWS Setup

### Requirements

Install the [AWS command line tools](https://aws.amazon.com/cli/)

### Credentials

Set up a named [AWS
profile](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html)
called `cfb` with an access key id and secret from AWS IAM. You may need to
create a new user in IAM with the ability to create and manage CloudFormation stacks.

### Create an SQS Queue

When creating the new queue:

Enable *Content-based deduplication*. In the GUI, it's shown as a checkbox in
the *Configuration* section. If you're using the CLI, set
`ContentBasedDeduplication` to `true` in your attributes map.

```
export AWS_PROFILE=cfb
aws sqs create-queue --queue-name "cfb-beacon-dev.fifo" --attributes '{ "MessageRetentionPeriod":"7200","FifoQueue":"true","ContentBasedDeduplication":"true" }'
```

## Slack Setup

[Create a Slack app](https://api.slack.com/apps?new_app=1)

To finish configuration, you'll need two more pieces of information: a signing
secret and a token.

You'll find the signing secret under **Basic Information**.

Under **OAuth & Permissions**, create a token by installing the new app in your
workspace. This will be your `BOT_OAUTH_TOKEN`. It usually starts with `xoxp` or
`xoxb`.

On the command line, in root of this project, run:

```bash
aws ssm put-parameter --name "/beacon/dev/slack/token" --value "BOT_OAUTH_TOKEN" --type SecureString
aws ssm put-parameter --name "/beacon/dev/slack/secret" --value "SIGNING_SECRET" --type SecureString
aws ssm put-parameter --name "/beacon/dev/github/secret" --value "GITHUB_SECRET" --type SecureString
```

with the appropriate values substituted.

## Google Sheets Setup

On the Google Cloud console, go to [Service
Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts/) and
create a new service account. Do not grant the account any permissions (roles)
during this stage of setup.

### Create Key

Go to the **Keys** tab and press **Add Key** then **Create new key**. Select
**JSON** as the key type. Move the downloaded file to the `functions` directory
and rename it `service-account.json`.

### Sheets: Add service account as editor

Copy the fully qualified email address for the new service account. It will look
something like **service-account-name@project-name.iam.gserviceaccount.com**.

In the RSVPs spreadsheet, open the sharing preferences and add the service
account email as an Editor.

## Deploying

Install `serverless` (e.g., with `npm install -g serverless`)

Switch to the `functions` directory.

Run `npm install`.

Run `serverless deploy -s prod`. If you omit the stage, it will default to `dev`.
