import { BlockAction, BlockActionConfig, CommandEvent, CommandConfig, ModuleRegistry, BlockActions, HandlerContext } from './loader';

const normalizeCommand =
  (cmd: string) => cmd.replace(/^\/+/g, '').toLowerCase();

export class CommandRegistry implements ModuleRegistry {
  commands: { [k in string]: CommandConfig } = {};
  blockActions: { [k in string]: BlockActionConfig } = {};

  registerCommand(command: string, config: CommandConfig) {
    this.commands[normalizeCommand(command)] = config;
  }

  registerBlockAction(actionId: string, config: BlockActionConfig) {
    this.blockActions[actionId] = config;
  }

  async _dispatchCommand(event: CommandEvent, context: HandlerContext) {
    const cmdMod = this.moduleForCommand(event.command);

    if (cmdMod)
      return await cmdMod.handler(event, context);
    else {
      console.warn(`Unrecognized command '${event.command}'`, event);
    }
  }

  async _dispatchBlockActions(event: BlockActions, action: BlockAction, context: HandlerContext) {
    const config = this.blockActions[action.action_id];

    if (config) {
      return await config.handler(event, action, context);
    }
  }

  async dispatch(message: any, context: HandlerContext) {
    if (message.command) {
      console.log('Handling command');
      return this._dispatchCommand(message, context);
    }

    if (message.type === 'block_actions') {
      console.log('Handling block actions');
      for (const action of message.actions) {
        await this._dispatchBlockActions(message, action, context);
      }
    }
  }

  moduleForCommand(command: string) {
    return this.commands[normalizeCommand(command)];
  }

  ackMessage(message: any) {
    if (message.command) {
      return this.moduleForCommand(message.command)?.ackMessage || '...';
    }

    if (message.type === 'block_actions') {
      for (const action of message.actions) {
        const message = this.blockActions[action.action_id]?.ackMessage;

        if (message)
          return message;
      }

      return '...';
    }

    return null;
  }
}
