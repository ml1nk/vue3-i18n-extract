#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { glob } from 'glob'
import { parse } from 'vue/compiler-sfc'
import { dump, load } from 'js-yaml'
import Yargs from 'yargs'

const argv = Yargs(process.argv.slice(2)).argv

function replaceBetween(str, start, end, what) {
  return str.substring(0, start) + what + str.substring(end)
}

function readData(imported) {
  const isYaml = argv.yaml !== undefined
  const data = isYaml ? load(imported) : JSON.parse(imported)
  Object.keys(data).forEach((file) => {
    const sfcContent = readFileSync(file).toString()
    const componentAst = parse(sfcContent)
    componentAst.descriptor.customBlocks
      .filter(block => block.type === 'i18n')
      .forEach((i18n) => {
        console.log(`updating file ${file}`)
        writeFileSync(
          file,
          replaceBetween(
            sfcContent,
            i18n.loc.start.offset,
            i18n.loc.end.offset,
            `\n${i18n.lang === 'yaml' ? dump(data[file]) : `${JSON.stringify(data[file], null, 2)}\n`}`,
          ),
        )
      })
  })
}

function runImport() {
  process.stdin.setEncoding('utf8')

  let importData = ''
  process.stdin.on('readable', () => {
    const chunk = process.stdin.read()
    if (chunk !== null)
      importData += chunk
  })

  process.stdin.on('end', () => {
    readData(importData)
  })
}

async function runExport(fn) {
  const dir = argv.dir || 'src/'
  const isYaml = argv.yaml !== undefined

  const files = await glob(`${dir}**/*.vue`)

  const out = {}
  files.forEach((file) => {
    const componentAst = parse(readFileSync(file).toString())
    componentAst.descriptor.customBlocks
      .filter(block => block.type === 'i18n')
      .forEach((block) => {
        out[file] = block.lang === 'yaml' ? load(block.content) : JSON.parse(block.content)
      })
  })
  fn ? fn(out) : console.log(isYaml ? dump(out) : JSON.stringify(out, null, 2))
}

switch (process.argv[2]) {
  case 'import':
    runImport()
    break
  case 'export':
    await runExport()
    break
  default:
    console.log(`vue3-i18n-sfc`)
    console.log('commands:')
    console.log('   vue3-i18n-sfc export > translations.json')
    console.log('     Collects all the <i18n> tags in SFC .vue files and exports them in a file\n')
    console.log('     Flags:')
    console.log('         --dir=src/ Specify the directory where SFCs are located, defaults to src/\n')
    console.log('         --yaml Import from yaml or export as yaml\n')
    console.log('   vue3-i18n-sfc import < translations.json')
    console.log('     Distributes all the changes on translations.json file to the related components\n')
}
