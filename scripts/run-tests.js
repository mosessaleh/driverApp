#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const extraArgs = args.length > 0 ? args : ['--runInBand'];

const jestBin = process.platform === 'win32'
  ? '.\\node_modules\\.bin\\jest.cmd'
  : './node_modules/.bin/jest';

const result = spawnSync(jestBin, ['--config', './jest.config.js', ...extraArgs], {
  stdio: 'inherit',
  shell: true,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);

