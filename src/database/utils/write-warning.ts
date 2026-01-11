import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export function writeRuntimeWarning(message: string, stack?: string) {
  const docsDir = join(process.cwd(), 'docs');
  const filePath = join(docsDir, 'runtime-warnings.md');

  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString();

  const entry = `
---

### ⚠️ ${timestamp}

**Contexto:** Seed / Migration cleanup  
**Mensaje:**  
\`\`\`
${message}
\`\`\`

${stack ? `**Stack:**\n\`\`\`\n${stack}\n\`\`\`` : ''}
`;

  appendFileSync(filePath, entry, { encoding: 'utf-8' });
}
