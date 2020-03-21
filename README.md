## Firebase setup

### Firebase CLI

[Install](https://firebase.google.com/docs/cli/) the Firebase command line
tools. There are a few installation options. `npm install -g firebase-tools` is
perhaps the simplest for people reading this.

### Firebase config

`cd` to the root of this repository and run `firebase login`.

If you're deploying to a project other than `cfb-services`, run `firebase use
--add` to select the Firebase project to use interactively or `firebase use
<id>` if you already know the id.

**You must use a project with billing enabled!** Otherwise, the cloud functions
will not be able to fetch data from external sites.

### Install node dependencies

In the `functions` directory, run `npm install`.

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
firebase functions:config:set slack.token=BOT_OAUTH_TOKEN
firebase functions:config:set slack.signing_secret=SIGNING_SECRET
```

with the appropriate values substituted.

## Deploying

From the root directory, run `firebase deploy`
