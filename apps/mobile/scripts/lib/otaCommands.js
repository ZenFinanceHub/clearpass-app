'use strict';

// Builds the two shell command lines publish-ota.js runs. They are run as
// single strings through the platform shell (cmd.exe on Windows, sh
// elsewhere), so every argument that can contain spaces is double-quoted
// here, in one place. Passing an args array with shell:true does NOT quote:
// Node joins the array with plain spaces, which split the env:exec inner
// command into separate flags on Windows (eas-cli: "Nonexistent flags:
// --platform, --platform, --output-dir").

/** Double-quotes one argument for both cmd.exe and sh. Rejects characters
 *  that either shell would still interpret inside double quotes, rather
 *  than trying to escape them. */
function quoteArg(value) {
  const s = String(value);
  if (/["%$`!\\\r\n]/.test(s)) {
    throw new Error(`Unsupported character in argument: ${JSON.stringify(s)}. Use plain text without quotes, %, $, \`, ! or backslashes.`);
  }
  return `"${s}"`;
}

function exportCommand(outputDir) {
  const inner = `npx expo export --platform ios --platform android --output-dir ${outputDir}`;
  return `npx eas-cli env:exec production ${quoteArg(inner)}`;
}

function updateCommand(inputDir, message) {
  return [
    'npx eas-cli update',
    '--branch production',
    '--environment production',
    '--skip-bundler',
    `--input-dir ${quoteArg(inputDir)}`,
    `--message ${quoteArg(message)}`,
    '--non-interactive',
  ].join(' ');
}

module.exports = { quoteArg, exportCommand, updateCommand };
