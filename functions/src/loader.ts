import { WebClient } from "@slack/web-api";

export interface CommandEvent {
  command: string,
  text: string,
  response_url: string,
  trigger_id: string,
  user_id: string,
  team_id: string,
  channel_id: string,

  user_name: string,
}

export interface BlockAction {
  action_id: string;
  block_id: string;
  text: any;
  value: string;
  type: string;
  action_ts: string;
};

export interface BlockActions {
  type: "block_actions";
  team: {
    id: string;
    domain: string;
  },
  user: {
    id: string;
    username: string;
    team_id: string;
  },
  api_app_id: string;
  token: string;
  container: any;
  trigger_id: string;
  channel: {
    id: string;
    name: string;
  };
  message: any;
  response_url: string;
  actions: BlockAction[];
}

export type HandlerContext = {
  client: WebClient,
};

export type CommandHandler =
  (event: CommandEvent, context: HandlerContext) => Promise<any>;
export type CommandConfig = {
  handler: CommandHandler,
  ackMessage?: string,
};

export type BlockActionHandler =
  (event: BlockActions, action: BlockAction, context: HandlerContext) => Promise<any>;
export type BlockActionConfig = {
  handler: BlockActionHandler,
  ackMessage?: string,
};

export interface ModuleRegistry {
  registerCommand(name: string, config: CommandConfig): void;
  registerBlockAction(actionId: string, config: BlockActionConfig): void;
};

export type CommandModuleLoader = (registry: ModuleRegistry) => void;
