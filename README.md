## AWS Setup

### Requirements

Install the [AWS command line tools](https://aws.amazon.com/cli/)

### Create an SQS Queue

When creating the new queue:

Enable *Content-based deduplication*. In the GUI, it's shown as a checkbox in
the *Configuration* section. If you're using the CLI, set
`ContentBasedDeduplication` to `true` in your attributes map.

Include the following in the access policy document's `Statements` array:

```
    {
      "Sid": "__lambdaPolicy",
      "Action": [
        "sqs:SendMessage"
      ],
      "Effect": "Allow",
      "Resource": "arn:aws:sqs:us-east-1:136974406105:cfb-beacon-dev.fifo",
      "Principal": {
        "AWS": [
          "arn:aws:iam::<ACCOUNT_ID>:role/beacon-cfb-<STAGE>-<REGION>-lambdaRole"
        ]
      }
    }
```

(Be sure to replace `ACCOUNT_ID` with your AWS account ID and `STAGE` and
`REGION` with deployment stage ('dev' by default) and region of the lambda
function.)

## Slack Setup

[Create a Slack app](https://api.slack.com/apps?new_app=1)

To finish configuration, you'll need two more pieces of information: a signing
secret and a token.

You'll find the signing secret under **Basic Information**.

Under **OAuth & Permissions**, create a token by installing the new app in your
workspace. This will be your `BOT_OAUTH_TOKEN`. It usually starts with `xoxp`
`xoxb`.

On the command line, in root of this project, run:

bash```
aws ssm put-parameter --name "/beacon/dev/slack/token" --value "BOT_OAUTH_TOKEN" --type SecureString
aws ssm put-parameter --name "/beacon/dev/slack/secret" --value "SIGNING_SECRET" --type SecureString
aws ssm put-parameter --name "/beacon/dev/github/secret" --value "GITHUB_SECRET" --type SecureString
```

with the appropriate values substituted.

## Deploying

Install `serverless` (e.g., with `npm install -g serverless`)

Switch to the `functions` directory.

Run `npm install`.

Run `serverless deploy -s prod`. If you omit the stage, it will default to `dev`.
