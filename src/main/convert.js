/*
 * MIT License
 *
 * Copyright (c) 2017 Uber Node.js
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// @flow

import {Thrift} from 'thriftrw';
import {TypeConverter} from './types';
import prettier from 'prettier';
import path from 'path';

import type {Base} from 'bufrw';
import type {Struct, Field, Enum, Typedef} from 'thriftrw/ast';

const thriftOptions = {
  strict: false,
  allowFilesystemAccess: true,
  allowOptionalArguments: true
};

export class ThriftFileConverter {
  thriftPath: string;
  thrift: Thrift;
  types = new TypeConverter();

  constructor(thriftPath: string) {
    this.thriftPath = path.resolve(thriftPath);
    this.thrift = new Thrift({...thriftOptions, entryPoint: thriftPath});
  }

  generateFlowFile = () =>
    prettier.format(
      [
        '// @flow',
        `// Generated by thrift2flow at ${new Date().toString()}\n// Source: ${this.thriftPath}`,
        this.generateImports(),
        ...this.thrift.asts[this.thrift.filename].definitions.map(this.convertDefinitionToCode)
      ]
        .filter(Boolean)
        .join('\n\n'),
      {parser: 'flow'}
    );

  convertDefinitionToCode = (def: any) => {
    switch (def.type) {
      case 'Struct':
      case 'Exception':
        return this.generateStruct(def);
      case 'Enum':
        return this.generateEnum(def);
      case 'Typedef':
        return this.generateTypedef(def);
      default:
        console.warn(
          `${path.basename(this.thriftPath)}: Skipping ${def.type} ${def.id ? def.id.name : '?'}`
        );
        return null;
    }
  };

  generateTypedef = (def: Typedef) =>
    `export type ${def.id.name} = ${this.types.convert(def.valueType)};`;

  generateEnum = (def: Enum) =>
    `export type ${def.id.name} = ${def.definitions.map(d => `"${d.id.name}"`).join(' | ')};`;

  generateStruct = ({id: {name}, fields}: Struct) =>
    `export type ${name} = {\n${Object.values(fields)
      .map(
        (f: Base) =>
          `${f.name}${this.isOptional(f) ? '?' : ''}: ${this.types.convert(f.valueType)};`
      )
      .join('\n')}};`;

  isOptional = (field: Field) => field.optional && field.defaultValue === null;

  generateImports = () =>
    this.getImportAbsPaths()
      .filter(p => p !== this.thriftPath)
      .map(p =>
        path.join(
          path.dirname(path.relative(path.dirname(this.thriftPath), p)),
          path.basename(p, '.thrift')
        )
      )
      .map(p => (p.indexOf('/') === -1 ? `./${p}` : p))
      .map(relpath => `import * as ${path.basename(relpath)} from '${relpath}.js';`)
      .join('\n');

  getImportAbsPaths = () => Object.keys(this.thrift.idls).map(p => path.resolve(p));
}