export interface TextEditorInput {
  command: 'view' | 'create' | 'str_replace' | 'insert';
  path: string;
  file_text?: string;
  old_str?: string;
  new_str?: string;
  insert_line?: number;
  view_range?: [number, number];
}

export function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

export function buildTextEditorCommand(input: TextEditorInput): string {
  switch (input.command) {
    case 'view': {
      if (input.view_range) {
        const [start, end] = input.view_range;
        return `sed -n '${start},${end}p' ${shellEscape(input.path)} | cat -n`;
      }
      return `cat -n ${shellEscape(input.path)}`;
    }
    case 'create': {
      const dir = input.path.substring(0, input.path.lastIndexOf('/'));
      const content = input.file_text || '';
      return `mkdir -p ${shellEscape(dir)} && cat > ${shellEscape(input.path)} << 'COMPEEK_EOF'\n${content}\nCOMPEEK_EOF`;
    }
    case 'str_replace': {
      const oldStr = input.old_str || '';
      const newStr = input.new_str || '';
      // Use python3 for reliable multi-line string replacement
      const pyScript = `
import sys
path = ${JSON.stringify(input.path)}
old = ${JSON.stringify(oldStr)}
new = ${JSON.stringify(newStr)}
with open(path, 'r') as f:
    content = f.read()
count = content.count(old)
if count == 0:
    print(f"Error: string not found in {path}", file=sys.stderr)
    sys.exit(1)
if count > 1:
    print(f"Error: found {count} occurrences, expected exactly 1", file=sys.stderr)
    sys.exit(1)
content = content.replace(old, new, 1)
with open(path, 'w') as f:
    f.write(content)
print(f"Replaced 1 occurrence in {path}")
`.trim();
      return `python3 -c ${shellEscape(pyScript)}`;
    }
    case 'insert': {
      const lineNum = input.insert_line || 0;
      const newStr = input.new_str || '';
      const pyScript = `
import sys
path = ${JSON.stringify(input.path)}
line_num = ${lineNum}
new_text = ${JSON.stringify(newStr)}
with open(path, 'r') as f:
    lines = f.readlines()
new_lines = new_text.split('\\n')
for i, line in enumerate(new_lines):
    lines.insert(line_num + i, line + '\\n')
with open(path, 'w') as f:
    f.writelines(lines)
print(f"Inserted {len(new_lines)} line(s) at line {line_num} in {path}")
`.trim();
      return `python3 -c ${shellEscape(pyScript)}`;
    }
    default:
      return `echo "Unknown text editor command: ${(input as TextEditorInput).command}"`;
  }
}

export function describeTextEditorAction(input: TextEditorInput): string {
  switch (input.command) {
    case 'view': return `Viewing ${input.path}${input.view_range ? ` (lines ${input.view_range[0]}-${input.view_range[1]})` : ''}`;
    case 'create': return `Creating ${input.path}`;
    case 'str_replace': return `Editing ${input.path}`;
    case 'insert': return `Inserting at line ${input.insert_line} in ${input.path}`;
    default: return `Text editor: ${(input as TextEditorInput).command}`;
  }
}
