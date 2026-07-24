#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  ARTBITRAGE_BUILD_JOY,
  BUILD_JOY_DEFAULT_TIMEOUT_MS,
  BUILD_JOY_MAX_TIMEOUT_MS,
  BUILD_JOY_TIMEOUT_GRACE_MS,
  buildJoyResponse,
} from "../functions/api/build-joy.js";

const USAGE = `Build with joy — optional attention around one real command

Choose a card only:
  node tools/build-with-joy.mjs [--seed TEXT]
  node tools/build-with-joy.mjs --json [--seed TEXT]

Wrap one command:
  node tools/build-with-joy.mjs [--seed TEXT] [--timeout-ms N] -- COMMAND [ARGS...]

Opt out of ornament:
  node tools/build-with-joy.mjs --quiet -- COMMAND [ARGS...]
  ARTBITRAGE_JOY=0 node tools/build-with-joy.mjs -- COMMAND [ARGS...]

The wrapper uses no shell. It adds no write, network request, or background
process of its own. The supplied command may have effects of its own, and the
published timeout can stop it. Do not invoke the wrapper for no wrapper behavior.`;

function usageError(message) {
  process.stderr.write(`build-with-joy: ${message}\n\n${USAGE}\n`);
  process.exitCode = 2;
}

function parseArguments(argv) {
  const parsed = {
    help: false,
    json: false,
    quiet: process.env.ARTBITRAGE_JOY === "0",
    seed: null,
    timeoutMs: BUILD_JOY_DEFAULT_TIMEOUT_MS,
    separatorSeen: false,
    command: [],
    error: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      parsed.separatorSeen = true;
      parsed.command = argv.slice(index + 1);
      break;
    }
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--quiet") {
      parsed.quiet = true;
      continue;
    }
    if (arg === "--seed") {
      if (index + 1 >= argv.length) {
        parsed.error = "--seed needs a value";
        break;
      }
      parsed.seed = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      if (index + 1 >= argv.length) {
        parsed.error = "--timeout-ms needs an integer";
        break;
      }
      const value = Number(argv[index + 1]);
      if (
        !Number.isSafeInteger(value)
        || value < 1
        || value > BUILD_JOY_MAX_TIMEOUT_MS
      ) {
        parsed.error =
          `--timeout-ms must be an integer from 1 to ${BUILD_JOY_MAX_TIMEOUT_MS}`;
        break;
      }
      parsed.timeoutMs = value;
      index += 1;
      continue;
    }
    parsed.error = `unknown wrapper option before --: ${arg}`;
    break;
  }

  if (!parsed.error && parsed.json && parsed.command.length) {
    parsed.error = "--json chooses a card only; it cannot wrap a command";
  } else if (!parsed.error && parsed.separatorSeen && !parsed.command.length) {
    parsed.error = "-- needs a command";
  }
  return parsed;
}

function cardText(response) {
  const card = response.selected_card;
  return [
    `BUILD JOY · ${card.title} · ${card.id}`,
    `Notice: ${card.notice}`,
    `During: ${card.during}`,
  ].join("\n");
}

function childEnvironment() {
  const environment = { ...process.env };
  if (environment.ARTBITRAGE_JOY === "0") {
    delete environment.ARTBITRAGE_JOY;
  }
  return environment;
}

async function runCommand(parsed, response) {
  if (!parsed.quiet) {
    process.stderr.write(
      `${cardText(response)}\nTruth stays first: child stdout is not decorated; failure remains failure.\n\n`,
    );
  }

  const [command, ...args] = parsed.command;
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: childEnvironment(),
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });

  const result = await new Promise(resolve => {
    let startError = null;
    let timedOut = false;
    let forceKillTimer = null;

    const timeoutTimer = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      timedOut = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
      }, BUILD_JOY_TIMEOUT_GRACE_MS);
    }, parsed.timeoutMs);

    child.once("error", error => {
      startError = error;
    });
    child.once("close", (status, signal) => {
      clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      resolve({ error: startError, signal, status, timedOut });
    });
  });

  if (result.timedOut) {
    process.stderr.write(`COMMAND TIMED OUT · limit ${parsed.timeoutMs} ms\n`);
    process.exitCode = ARTBITRAGE_BUILD_JOY.failure_policy.timeout_exit;
  } else if (result.error) {
    if (result.error.code === "ENOENT") {
      process.stderr.write("COMMAND NOT FOUND\n");
      process.exitCode =
        ARTBITRAGE_BUILD_JOY.failure_policy.missing_command_exit;
    } else if (result.error.code === "EACCES") {
      process.stderr.write("COMMAND COULD NOT START · permission denied\n");
      process.exitCode = 126;
    } else {
      process.stderr.write("COMMAND COULD NOT START\n");
      process.exitCode = 1;
    }
  } else if (result.signal) {
    if (!parsed.quiet) {
      process.stderr.write(`COMMAND STOPPED · signal ${result.signal}\n`);
    }
    try {
      process.kill(process.pid, result.signal);
    } catch {
      process.exitCode = 1;
    }
  } else {
    const status = Number.isInteger(result.status) ? result.status : 1;
    process.exitCode = status;
    if (!parsed.quiet && status === 0) {
      process.stderr.write(
        `\nCOMMAND OK · exit 0\nOptional gift: ${response.selected_card.gift}\nNothing is collected or stored.\n`,
      );
    } else if (!parsed.quiet && status !== 0) {
      process.stderr.write(`\nCOMMAND FAILED · exit ${status}\n`);
    }
  }
}

const parsed = parseArguments(process.argv.slice(2));

if (parsed.error) {
  usageError(parsed.error);
} else if (parsed.help) {
  process.stdout.write(`${USAGE}\n`);
} else {
  const commandSeed = parsed.command.length
    ? parsed.command.join("\u0000")
    : "artbitrage-build";
  const response = buildJoyResponse(parsed.seed ?? commandSeed);

  if (!parsed.command.length) {
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
    } else if (!parsed.quiet) {
      process.stdout.write(
        `${cardText(response)}\nOptional gift after a successful build: ${response.selected_card.gift}\n`,
      );
    }
  } else {
    await runCommand(parsed, response);
  }
}
