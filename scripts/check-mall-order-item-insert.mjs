#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('server/src/modules/mall.rs'), 'utf8')
const insertMatch = source.match(/INSERT INTO mall_order_items \(\s*([\s\S]*?)\s*\)\s*VALUES \(([\s\S]*?)\)\s*"#,[\s\S]*?\.execute\(&mut \*tx\)/)

if (!insertMatch) {
  throw new Error('Cannot locate mall_order_items insert SQL in server/src/modules/mall.rs')
}

const columns = insertMatch[1]
  .split(',')
  .map((column) => column.trim())
  .filter(Boolean)
const placeholders = Array.from(insertMatch[2].matchAll(/\$(\d+)/g)).map((match) => Number(match[1]))
const bindCount = Array.from(insertMatch[0].matchAll(/\.bind\(/g)).length
const maxPlaceholder = Math.max(...placeholders)

if (columns.length !== maxPlaceholder) {
  throw new Error(`mall_order_items insert has ${columns.length} columns but highest SQL placeholder is $${maxPlaceholder}`)
}

if (columns.length !== bindCount) {
  throw new Error(`mall_order_items insert has ${columns.length} columns but ${bindCount} bound values`)
}

console.log(`Mall order item insert check passed (${columns.length} columns).`)
