#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function nextPatchVersion(version) {
  const normalized = String(version || '').trim();
  const match = normalized.match(VERSION_PATTERN);
  if (!match) {
    throw new Error(`Invalid package version: ${normalized}`);
  }

  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

export function bumpPackageVersion(packageJsonPath) {
  const source = fs.readFileSync(packageJsonPath, 'utf8');
  const pkg = JSON.parse(source);
  const version = nextPatchVersion(pkg.version);
  pkg.version = version;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return version;
}

function isMainModule() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const packageJsonPath = path.resolve(process.argv[2] || 'package.json');
  const version = bumpPackageVersion(packageJsonPath);
  process.stdout.write(`${version}\n`);
}
