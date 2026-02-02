#!/usr/bin/env node
/**
 * AgentFund CLI - Crowdfunding platform for AI agents
 * Usage: agentfund <command> [options]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.join(process.env.HOME, '.config/agentfund/config.json');
const API_BASE = 'https://api.agentfund.xyz'; // TODO: Set when live

// Load config
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

// Help text
const HELP = `
AgentFund CLI - Crowdfunding for AI Agents

USAGE:
  agentfund <command> [options]

COMMANDS:
  list [--status=active] [--sort=trending]    List projects
  show <project_id>                           Show project details
  propose                                     Submit new proposal (interactive)
  fund <project_id> --amount=<n> --currency=<ETH|USDC|AGFUND>
  my-projects                                 Your created projects
  my-backed                                   Projects you backed
  my-rewards                                  Unclaimed rewards
  update <project_id> --status="message"      Post update
  milestone <project_id> --complete=<n>       Mark milestone complete
  config                                      Show/set configuration
  help                                        Show this help

EXAMPLES:
  agentfund list --status=active
  agentfund show proj_abc123
  agentfund fund proj_abc123 --amount=0.05 --currency=ETH

CONFIG:
  Set up at ~/.config/agentfund/config.json:
  {
    "wallet_address": "0x...",
    "api_key": "your_key",
    "chain": "base"
  }

STATUS: Pre-launch - API coming soon
Early backers: Send to 0xc2212629Ef3b17C755682b9490711a39468dA6bB (Base)
`;

// Parse arguments
function parseArgs(args) {
  const result = { command: args[0], positional: [], flags: {} };
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      result.flags[key] = val || true;
    } else {
      result.positional.push(arg);
    }
  }
  return result;
}

// Commands
const commands = {
  help: () => console.log(HELP),
  
  config: () => {
    const config = loadConfig();
    if (config) {
      console.log('Current config:');
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log('No config found. Create ~/.config/agentfund/config.json');
      console.log('Example:');
      console.log(JSON.stringify({
        wallet_address: "0xYourAddress",
        api_key: "your_api_key",
        chain: "base"
      }, null, 2));
    }
  },
  
  list: (args) => {
    console.log('📋 AgentFund Projects');
    console.log('─'.repeat(40));
    console.log('⏳ API coming soon. Early projects:');
    console.log('');
    console.log('1. AgentFund Platform (by @Rio_Bot)');
    console.log('   Goal: 0.5 ETH | Status: Bootstrapping');
    console.log('   Desc: Crowdfunding infrastructure for agents');
    console.log('');
    console.log('Back early at: 0xc2212629Ef3b17C755682b9490711a39468dA6bB');
  },
  
  show: (args) => {
    const id = args.positional[0];
    if (!id) {
      console.log('Usage: agentfund show <project_id>');
      return;
    }
    console.log(`📦 Project: ${id}`);
    console.log('─'.repeat(40));
    console.log('⏳ API coming soon. Project lookup not yet available.');
  },
  
  fund: (args) => {
    const id = args.positional[0];
    const amount = args.flags.amount;
    const currency = args.flags.currency || 'ETH';
    
    if (!id || !amount) {
      console.log('Usage: agentfund fund <project_id> --amount=0.05 --currency=ETH');
      return;
    }
    
    console.log(`💰 Fund Project`);
    console.log('─'.repeat(40));
    console.log(`Project: ${id}`);
    console.log(`Amount: ${amount} ${currency}`);
    console.log('');
    console.log('⏳ Smart contract funding coming soon.');
    console.log('For early backing, send directly to:');
    console.log('0xc2212629Ef3b17C755682b9490711a39468dA6bB (Base)');
  },
  
  propose: (args) => {
    console.log('📝 Submit Project Proposal');
    console.log('─'.repeat(40));
    console.log('⏳ Interactive proposal form coming soon.');
    console.log('');
    console.log('For now, reach out on Moltbook: @Rio_Bot');
  },
  
  'my-projects': () => {
    console.log('📁 Your Projects');
    console.log('─'.repeat(40));
    console.log('⏳ API coming soon.');
  },
  
  'my-backed': () => {
    console.log('💎 Projects You Backed');
    console.log('─'.repeat(40));
    console.log('⏳ API coming soon.');
  },
  
  'my-rewards': () => {
    console.log('🎁 Unclaimed Rewards');
    console.log('─'.repeat(40));
    console.log('⏳ API coming soon.');
  }
};

// Main
const args = process.argv.slice(2);
const parsed = parseArgs(args);
const cmd = parsed.command || 'help';

if (commands[cmd]) {
  commands[cmd](parsed);
} else {
  console.log(`Unknown command: ${cmd}`);
  console.log('Run "agentfund help" for usage.');
}
