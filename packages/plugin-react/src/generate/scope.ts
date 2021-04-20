import * as t from '@babel/types';
import { _declare, _require } from 'syntax';

import { createElement as createJS } from './es5';
import { createElement as createJSX } from './jsx';

import type { NodePath as Path } from '@babel/traverse';
import type {
  CallExpression,
  Expression,
  Identifier,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  JSXElement,
  JSXMemberExpression,
  ObjectProperty,
  Program,
  Statement,
  VariableDeclaration
} from '@babel/types';
import type { StackFrame } from 'context';
import type { BunchOf, Options, PropData } from 'types';

type ImportSpecific =
  | ImportSpecifier 
  | ImportDefaultSpecifier 
  | ImportNamespaceSpecifier;

interface ElementReact {
  props: PropData[];
  children: Expression[];
}

export abstract class FileManager {
  protected body: Statement[];

  protected imports = {} as BunchOf<(ObjectProperty | ImportSpecific)[]>
  protected importIndices = {} as BunchOf<number>;

  constructor(
    private path: Path<Program>,
    protected context: StackFrame){

    const create = context.opts.output === "js" ? createJS : createJSX;

    this.createElement = create.bind(context);
    this.body = path.node.body;
  }

  abstract ensure(from: string, name: string, alt?: string): Identifier;
  abstract ensureImported(from: string): void;
  abstract createImport(name: string): Statement | undefined;

  private createElement: (
    tag: null | string | JSXMemberExpression,
    properties?: PropData[],
    content?: Expression[]
  ) => CallExpression | JSXElement | undefined;

  element(
    src: ElementReact,
    tagName?: string | JSXMemberExpression){

    const tag = tagName || "div";
    return this.createElement(tag, src.props, src.children);
  }

  container(
    src: ElementReact,
    key?: Identifier){

    let { children } = src;

    if(src.props.length)
      children = [ this.element(src)! ];

    if(children.length > 1 || key){
      const props = key && [{ name: "key", value: key }];
      return this.createElement(null, props, children)
    }

    return children[0] || t.booleanLiteral(false);
  }

  replaceAlias(value: string){
    if(value[0] !== "$")
      return value;

    const name = value.slice(1) as keyof Options;
    return this.context.opts[name] as string;
  }

  ensureUID(name = "temp"){
    const { scope } = this.path;

    let uid = name = name
      .replace(/^_+/, "")
      .replace(/[0-9]+$/g, "");

    for(let i = 2;
      scope.hasBinding(uid) ||
      scope.hasGlobal(uid) ||
      scope.hasReference(uid);
      i++
    ){
      uid = name + i;
    }

    const program = scope.getProgramParent() as any;
    program.references[uid] = program.uids[uid] = true;
    return uid;
  }

  ensureUIDIdentifier(name: string){
    return t.identifier(this.ensureUID(name));
  }

  EOF(){
    if(this.context.opts.externals === false)
      return;

    Object
      .entries(this.imports)
      .forEach(([ name ]) => {
        const importStatement = this.createImport(name);
  
        if(importStatement){
          const index = this.importIndices[name];
          this.body.splice(index, 0, importStatement);
        }
      })
  }
}

export class ImportManager extends FileManager {
  imports = {} as BunchOf<ImportSpecific[]>

  ensure(from: string, name: string, alt = name){
    from = this.replaceAlias(from);

    let uid;
    const list = this.imports[from] || this.ensureImported(from);

    if(name == "default"){
      if(t.isImportDefaultSpecifier(list[0]))
        return list[0].local;
      else {
        uid = this.ensureUIDIdentifier(alt);
        list.unshift(t.importDefaultSpecifier(uid));
        return uid
      }
    }

    for(const spec of list)
      if("imported" in spec && t.isIdentifier(spec.imported, { name })){
        uid = t.identifier(spec.local.name);
        break;
      }

    if(!uid){
      uid = this.ensureUIDIdentifier(alt || name);
      list.push(
        t.importSpecifier(uid, t.identifier(name))
      )
    }

    return uid;
  }

  ensureImported(name: string){
    const { imports, body } = this;

    name = this.replaceAlias(name);

    for(const stat of body)
      if(t.isImportDeclaration(stat) && stat.source.value == name)
        return imports[name] = stat.specifiers;

    return imports[name] = [];
  }

  createImport(name: string){
    const list = this.imports[name];

    if(list.length)
      return t.importDeclaration(list, t.stringLiteral(name));
  }
}

export class RequireManager extends FileManager {
  imports = {} as BunchOf<ObjectProperty[]>
  importTargets = {} as BunchOf<Expression | false>

  ensure(from: string, name: string, alt = name){
    const source = this.ensureImported(from);

    for(const { key, value } of source)
      if(t.isIdentifier(key, { name }) && t.isIdentifier(value))
        return value;

    const ref = this.ensureUIDIdentifier(alt);
    const key = t.identifier(name);
    const useShorthand = ref.name === name;
    const property = t.objectProperty(key, ref, false, useShorthand);

    source.push(property)

    return ref;
  }

  ensureImported(name: string){
    const { body, imports, importTargets } = this;
    
    name = this.replaceAlias(name);

    if(name in imports)
      return imports[name];

    let target;
    let list;

    for(let i = 0, stat; stat = body[i]; i++)
      if(t.isVariableDeclaration(stat))
        target = requireResultFrom(name, stat);

    if(target && t.isObjectPattern(target))
      list = imports[name] = target.properties as ObjectProperty[];
    else {
      list = imports[name] = [];

      if(t.isIdentifier(target))
        importTargets[name] = target;
    }

    return list;
  }

  createImport(name: string){
    const list = this.imports[name]

    if(list.length){
      const target = this.importTargets[name] || _require(name);
      return _declare("const", t.objectPattern(list), target);
    }
  }
}

function requireResultFrom(
  name: string,
  statement: VariableDeclaration){

  for(const { init, id } of statement.declarations)
    if(t.isCallExpression(init)
    && t.isIdentifier(init.callee, { name: "require" })
    && t.isStringLiteral(init.arguments[0], { value: name }))
      return id;
}