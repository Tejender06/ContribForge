import readline from "readline";
import { ContribForgeEngine } from "./agent-engine.mjs";

const autoApprove = process.argv.includes("--auto-approve") || process.argv.includes("-y");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m"
};

function logHeader() {
  console.log(`\n${colors.cyan}${colors.bright}================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}         ContribForge: Autonomous Issue Resolver Copilot         ${colors.reset}`);
  console.log(`${colors.cyan}             TrueFoundry × Polaris Hackathon Build              ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}================================================================${colors.reset}\n`);
}

async function main() {
  logHeader();

  const engine = new ContribForgeEngine((event) => {
    if (event.type === "step_update") {
      const { step } = event;
      const statusIcon =
        step.status === "SUCCESS"
          ? `${colors.green}✔${colors.reset}`
          : step.status === "IN_PROGRESS"
          ? `${colors.yellow}⏳${colors.reset}`
          : step.status === "AWAITING_APPROVAL"
          ? `${colors.magenta}🛡️ [PAUSE GATE]${colors.reset}`
          : step.status === "ERROR"
          ? `${colors.red}✖${colors.reset}`
          : `${colors.cyan}ℹ${colors.reset}`;

      console.log(`[${new Date().toLocaleTimeString()}] ${statusIcon} ${colors.bright}${step.title}${colors.reset}`);

      if (step.verdict) {
        console.log(`   ${colors.yellow}↳ ${step.verdict}${colors.reset}`);
      }
      if (step.testsPassed) {
        console.log(`   ${colors.green}↳ ${step.testsPassed} (${step.summary})${colors.reset}`);
      }
      if (step.prUrl) {
        console.log(`   ${colors.green}${colors.bright}↳ Live Pull Request: ${step.prUrl}${colors.reset}`);
      }
    }

    if (event.type === "approval_required") {
      console.log(`\n${colors.yellow}${colors.bright}----------------------------------------------------------------${colors.reset}`);
      console.log(`${colors.yellow}${colors.bright}🛡️  HUMAN-IN-THE-LOOP CHECKPOINT: Approval Required             ${colors.reset}`);
      console.log(`${colors.yellow}Tool: submit_pull_request                                       ${colors.reset}`);
      console.log(`${colors.yellow}Target: ${event.payload.owner}/${event.payload.repo} (Branch: ${event.payload.head_branch})${colors.reset}`);
      console.log(`${colors.yellow}Title: ${event.payload.title}${colors.reset}`);
      console.log(`${colors.yellow}${colors.bright}----------------------------------------------------------------${colors.reset}`);

      if (autoApprove) {
        console.log(`\n${colors.cyan}[--auto-approve flag detected: Approving action...]${colors.reset}\n`);
        setTimeout(() => engine.handleApprovalDecision(true), 1000);
      } else {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        rl.question(`\n${colors.bright}Allow agent to execute irreversible PR creation? [Y/n]: ${colors.reset}`, (answer) => {
          rl.close();
          const allow = answer.trim().toLowerCase() !== "n";
          if (allow) {
            console.log(`\n${colors.green}✔ User Approved. Resuming autonomous agent loop...${colors.reset}\n`);
          } else {
            console.log(`\n${colors.red}✖ User Denied. Operation cancelled.${colors.reset}\n`);
          }
          engine.handleApprovalDecision(allow);
        });
      }
    }
  });

  const issueArg = process.argv.slice(2).find((arg) => !arg.startsWith("-") && !isNaN(Number(arg)));
  const issueNumber = issueArg ? Number(issueArg) : 14;

  console.log(`${colors.cyan}Target: Issue #${issueNumber} in demo-target-repo (micro-config)${colors.reset}`);
  console.log(`${colors.cyan}Starting Autonomous Test-Driven Resolution Loop...\n${colors.reset}`);

  try {
    await engine.runWorkflow({
      owner: "truefoundry",
      repo: "micro-config",
      issueNumber
    });
    console.log(`\n${colors.green}${colors.bright}🎉 Mission Complete! Pull Request is ready for review.${colors.reset}\n`);
  } catch (err) {
    console.error(`\n${colors.red}Run terminated with error: ${err.message}${colors.reset}\n`);
    process.exit(1);
  }
}

main();
