#!/usr/bin/env node
/**
 * AgentFund Escrow Interaction Script
 * 
 * Usage:
 *   node escrow-interact.js create --name "My Project" --goal 0.1 --days 14 --milestones "v1:0.05,v2:0.05"
 *   node escrow-interact.js fund --project 0 --amount 0.05
 *   node escrow-interact.js list
 *   node escrow-interact.js status --project 0
 */

const { createPublicClient, http, parseEther, formatEther, encodeFunctionData } = require('viem');
const { base } = require('viem/chains');

// Config
const ESCROW = '0x6a4420f696c9ba6997f41dddc15b938b54aa009a';
const SAFESKILLS_API = 'https://safeskill-production.up.railway.app';
const SAFESKILLS_KEY = process.env.SAFESKILLS_KEY || 'ssk_20d004d7be88aa5e30f1c21af46662de270e2a9d983e915769fd74023cfbfd05';

// ABI (minimal)
const ESCROW_ABI = [
  {
    name: 'createProject',
    type: 'function',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'fundingGoal', type: 'uint256' },
      { name: 'durationDays', type: 'uint256' },
      { name: 'milestoneDescriptions', type: 'string[]' },
      { name: 'milestoneAmounts', type: 'uint256[]' }
    ],
    outputs: [{ name: 'projectId', type: 'uint256' }]
  },
  {
    name: 'fundProject',
    type: 'function',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: []
  },
  {
    name: 'projectCount',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'getProject',
    type: 'function',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'creator', type: 'address' },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'fundingGoal', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'totalFunded', type: 'uint256' },
        { name: 'milestonesCompleted', type: 'uint256' },
        { name: 'totalMilestones', type: 'uint256' },
        { name: 'cancelled', type: 'bool' },
        { name: 'fullyFunded', type: 'bool' }
      ]
    }]
  },
  {
    name: 'getMilestones',
    type: 'function',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{
      type: 'tuple[]',
      components: [
        { name: 'description', type: 'string' },
        { name: 'fundAmount', type: 'uint256' },
        { name: 'completed', type: 'bool' }
      ]
    }]
  }
];

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

async function sendTx(data, value = '0') {
  const response = await fetch(`${SAFESKILLS_API}/api/skills/evm-wallet/send-transaction`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SAFESKILLS_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: ESCROW, data, value, chainId: 8453 }),
  });
  return response.json();
}

// Commands
async function createProject(args) {
  const name = args.name || 'Untitled Project';
  const description = args.description || '';
  const goal = parseEther(args.goal || '0.1');
  const days = BigInt(args.days || 14);
  
  // Parse milestones: "v1:0.05,v2:0.05"
  const milestoneStr = args.milestones || `Completion:${args.goal || '0.1'}`;
  const parts = milestoneStr.split(',');
  const descriptions = [];
  const amounts = [];
  
  for (const part of parts) {
    const [desc, amt] = part.split(':');
    descriptions.push(desc.trim());
    amounts.push(parseEther(amt.trim()));
  }
  
  console.log(`Creating project: ${name}`);
  console.log(`Goal: ${formatEther(goal)} ETH`);
  console.log(`Duration: ${days} days`);
  console.log(`Milestones: ${descriptions.join(', ')}`);
  
  const data = encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: 'createProject',
    args: [name, description, goal, days, descriptions, amounts]
  });
  
  const result = await sendTx(data);
  console.log('\nResult:', JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log(`\n✅ Project created! TX: ${result.data.txHash}`);
  }
}

async function fundProject(args) {
  const projectId = BigInt(args.project || 0);
  const amount = args.amount || '0.01';
  
  console.log(`Funding project ${projectId} with ${amount} ETH...`);
  
  const data = encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: 'fundProject',
    args: [projectId]
  });
  
  const result = await sendTx(data, parseEther(amount).toString());
  console.log('\nResult:', JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log(`\n✅ Funded! TX: ${result.data.txHash}`);
  }
}

async function listProjects() {
  const count = await publicClient.readContract({
    address: ESCROW,
    abi: ESCROW_ABI,
    functionName: 'projectCount'
  });
  
  console.log(`\n📋 AgentFund Projects (${count} total)\n`);
  console.log('─'.repeat(50));
  
  for (let i = 0n; i < count; i++) {
    const project = await publicClient.readContract({
      address: ESCROW,
      abi: ESCROW_ABI,
      functionName: 'getProject',
      args: [i]
    });
    
    const deadline = new Date(Number(project.deadline) * 1000);
    const funded = Number(project.totalFunded) / 1e18;
    const goal = Number(project.fundingGoal) / 1e18;
    const pct = goal > 0 ? (funded / goal * 100).toFixed(1) : 0;
    
    console.log(`#${i}: ${project.name}`);
    console.log(`   Creator: ${project.creator.slice(0, 10)}...`);
    console.log(`   Funded: ${funded.toFixed(4)} / ${goal.toFixed(4)} ETH (${pct}%)`);
    console.log(`   Milestones: ${project.milestonesCompleted}/${project.totalMilestones}`);
    console.log(`   Status: ${project.cancelled ? '❌ Cancelled' : project.fullyFunded ? '✅ Funded' : '🟡 Active'}`);
    console.log(`   Deadline: ${deadline.toISOString()}`);
    console.log('');
  }
  
  if (count === 0n) {
    console.log('No projects yet. Be the first to create one!');
    console.log('\nUsage: node escrow-interact.js create --name "My Project" --goal 0.1 --days 14');
  }
}

async function projectStatus(args) {
  const projectId = BigInt(args.project || 0);
  
  const project = await publicClient.readContract({
    address: ESCROW,
    abi: ESCROW_ABI,
    functionName: 'getProject',
    args: [projectId]
  });
  
  const milestones = await publicClient.readContract({
    address: ESCROW,
    abi: ESCROW_ABI,
    functionName: 'getMilestones',
    args: [projectId]
  });
  
  console.log(`\n📦 Project #${projectId}: ${project.name}\n`);
  console.log('─'.repeat(50));
  console.log(`Creator: ${project.creator}`);
  console.log(`Description: ${project.description || '(none)'}`);
  console.log(`Goal: ${formatEther(project.fundingGoal)} ETH`);
  console.log(`Funded: ${formatEther(project.totalFunded)} ETH`);
  console.log(`Deadline: ${new Date(Number(project.deadline) * 1000).toISOString()}`);
  console.log(`Status: ${project.cancelled ? 'Cancelled' : project.fullyFunded ? 'Fully Funded' : 'Active'}`);
  
  console.log(`\nMilestones:`);
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    console.log(`  ${i + 1}. ${m.description} - ${formatEther(m.fundAmount)} ETH ${m.completed ? '✅' : '⏳'}`);
  }
}

// Parse args
const args = {};
let command = process.argv[2] || 'help';

for (let i = 3; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) {
    const [key, val] = arg.slice(2).split('=');
    args[key] = val || process.argv[++i];
  }
}

// Run
const commands = {
  create: createProject,
  fund: fundProject,
  list: listProjects,
  status: projectStatus,
  help: () => {
    console.log(`
AgentFund Escrow CLI

Commands:
  create    Create a new project
            --name "Project Name"
            --description "What you're building"
            --goal 0.1 (ETH)
            --days 14
            --milestones "v1:0.05,v2:0.05"
            
  fund      Fund an existing project
            --project 0 (project ID)
            --amount 0.05 (ETH)
            
  list      List all projects
  
  status    Get project details
            --project 0

Contract: ${ESCROW}
    `);
  }
};

if (commands[command]) {
  commands[command](args).catch(console.error);
} else {
  console.log(`Unknown command: ${command}`);
  commands.help();
}
