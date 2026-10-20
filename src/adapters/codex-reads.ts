import { parse, type Node, type CallExpression, type MemberExpression,
  type Identifier, type Literal, type ObjectExpression, type TemplateLiteral,
  type ArrayExpression } from 'acorn';

const SHELL_TOOLS = new Set(['exec_command', 'shell', 'shell_command']);
const READ_COMMANDS = new Set(['cat', 'get-content', 'gc', 'type', 'head', 'tail', 'more', 'sed']);
const SKILL_PATH = /(?:^|[/\\])skills[/\\](?:\.system[/\\])?([^/\\]+)[/\\]SKILL\.md$/;

interface ToolCall {
  type?: string;
  name?: string;
  arguments?: unknown;
  input?: unknown;
}

/** Static attempted-read evidence only. Session content is never evaluated. */
export function codexSkillReads(call: ToolCall): string[] {
  const name = typeof call.name === 'string' ? call.name.split('.').at(-1) : undefined;
  const commands: unknown[] = [];
  if (call.type === 'function_call' && typeof call.arguments === 'string') {
    let args: Record<string, unknown>;
    try {
      const value: unknown = JSON.parse(call.arguments);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      args = value as Record<string, unknown>;
    } catch {
      return [];
    }
    if (name && SHELL_TOOLS.has(name)) commands.push(args.cmd ?? args.command);
    else if (name === 'exec' && typeof args.code === 'string') commands.push(...scriptCommands(args.code));
  } else if (call.type === 'custom_tool_call' && typeof call.input === 'string') {
    if (name && SHELL_TOOLS.has(name)) commands.push(call.input);
    else if (name === 'exec') commands.push(...scriptCommands(call.input));
  }

  const names = new Set<string>();
  for (const command of commands) {
    for (const path of readPaths(command)) {
      const name = SKILL_PATH.exec(path)?.[1];
      if (name && name !== '.' && name !== '..' && name !== '.system') names.add(name);
    }
  }
  return [...names];
}

function scriptCommands(code: string): unknown[] {
  let tree: Node;
  try {
    tree = parse(code, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true });
  } catch {
    return [];
  }
  const commands: unknown[] = [];
  const pending = [tree];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.type === 'CallExpression') {
      const call = node as CallExpression;
      if (call.callee.type === 'MemberExpression') {
        const member = call.callee as MemberExpression;
        if (!member.computed && member.object.type === 'Identifier' &&
            (member.object as Identifier).name === 'tools' && member.property.type === 'Identifier' &&
            SHELL_TOOLS.has((member.property as Identifier).name)) {
          const arg = call.arguments[0];
          if (arg?.type === 'ObjectExpression') commands.push(objectCommand(arg as ObjectExpression));
        }
      }
    }
    // Walk syntax nodes, never strings/comments; no logged code is executed.
    for (const value of Object.values(node)) {
      const children = Array.isArray(value) ? value : [value];
      for (const child of children) {
        if (child && typeof child === 'object' && typeof child.type === 'string') pending.push(child as Node);
      }
    }
  }
  return commands;
}

function objectCommand(object: ObjectExpression): unknown {
  const fields = new Map<string, unknown>();
  for (const property of object.properties) {
    // A spread/computed key could replace an earlier command at runtime.
    if (property.type !== 'Property' || property.computed) return undefined;
    const key = property.key.type === 'Identifier' ? property.key.name :
      property.key.type === 'Literal' ? property.key.value : undefined;
    if (typeof key === 'string') fields.set(key, staticValue(property.value));
  }
  return fields.has('cmd') ? fields.get('cmd') : fields.get('command');
}

function staticValue(node: Node): unknown {
  if (node.type === 'Literal') return (node as Literal).value;
  if (node.type === 'TemplateLiteral') {
    const template = node as TemplateLiteral;
    if (template.expressions.length === 0) return template.quasis[0]?.value.cooked;
  }
  if (node.type === 'ArrayExpression') {
    return (node as ArrayExpression).elements.map(item => item ? staticValue(item) : undefined);
  }
  return undefined;
}

function readPaths(command: unknown, depth = 0): string[] {
  if (depth > 3) return [];
  if (Array.isArray(command)) {
    if (!command.every(item => typeof item === 'string')) return [];
    return operandPaths(command, depth);
  }
  if (typeof command !== 'string') return [];
  return shellStatements(command).flatMap(tokens => operandPaths(tokens, depth));
}

function operandPaths(tokens: string[], depth: number): string[] {
  const executable = tokens[0]?.split(/[/\\]/).at(-1)?.toLowerCase().replace(/\.exe$/, '');
  if (!executable) return [];
  // Explicit shell wrappers are common in the older command-array format.
  if (['bash', 'sh', 'zsh', 'pwsh', 'powershell'].includes(executable)) {
    const index = tokens.findIndex((token, index) => index > 0 &&
      (/^-[a-z]*c$/.test(token) || token.toLowerCase() === '-command'));
    return index < 0 ? [] : readPaths(tokens[index + 1], depth + 1);
  }
  if (!READ_COMMANDS.has(executable)) return [];
  const redirect = tokens.findIndex(token => /^[<>]/.test(token));
  const args = tokens.slice(1, redirect < 0 ? undefined : redirect);
  if (args.some(arg => ['--help', '--version', '-?'].includes(arg))) return [];
  if (executable === 'sed') {
    // Only the common non-mutating print form; scripts and -i are not inferred.
    return args[0] === '-n' && /^(?:\d+(?:,\d+|,\$)?|\$)?p$/.test(args[1] ?? '')
      ? args.slice(2).filter(arg => !arg.startsWith('-')) : [];
  }

  const paths: string[] = [];
  const valueOptions = executable === 'get-content' || executable === 'gc'
    ? new Set(['-totalcount', '-tail', '-encoding', '-delimiter', '-filter', '-include', '-exclude', '-readcount', '-credential'])
    : executable === 'head' || executable === 'tail'
      ? new Set(['-n', '-c', '--lines', '--bytes']) : new Set<string>();
  let endOptions = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--') { endOptions = true; continue; }
    if (!endOptions && valueOptions.has(arg.toLowerCase())) { i++; continue; }
    if (!endOptions && arg.startsWith('-')) continue;
    paths.push(arg);
  }
  return paths;
}

/** Small shell lexer: quoted operands, comments, pipelines and statement breaks.
 * Deliberately does not interpret variables, substitutions or arbitrary scripts.
 */
function shellStatements(command: string): string[][] {
  // Here-doc bodies are data and can contain apparent read commands. Leave
  // this syntax unsupported rather than interpreting those examples as calls.
  if (command.includes('<<')) return [];
  const statements: string[][] = [];
  let tokens: string[] = [];
  let token = '';
  let quote = '';
  const flushToken = () => { if (token) tokens.push(token); token = ''; };
  const flushStatement = () => { flushToken(); if (tokens.length) statements.push(tokens); tokens = []; };
  for (let i = 0; i < command.length; i++) {
    const char = command[i]!;
    if (quote) {
      if (char === quote) {
        if (quote === "'" && command[i + 1] === "'") { token += "'"; i++; }
        else quote = '';
      } else if (quote === '"' && (char === '\\' || char === '`') && command[i + 1] === '"') {
        token += '"'; i++;
      } else token += char;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === '<' && command[i + 1] === '#') {
      const end = command.indexOf('#>', i + 2);
      if (end < 0) return [];
      i = end + 1;
    } else if (char === '#' && !token) {
      while (i < command.length && command[i] !== '\n') i++;
      flushStatement();
    } else if (';|&\n\r'.includes(char)) {
      flushStatement();
    } else if (char === '<' || char === '>') {
      flushToken(); tokens.push(char);
    } else if (/\s/.test(char) || char === ',') {
      flushToken();
    } else {
      token += char;
    }
  }
  if (quote) return [];
  flushStatement();
  return statements;
}
