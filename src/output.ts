import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** 文件输出不经过 shell 文本管道，直接保存无 BOM UTF-8。 */
export async function emitReport(text: string, outputPath?: string): Promise<void> {
  if (outputPath === undefined) {
    console.log(text);
    return;
  }
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  } catch (error) {
    console.error(`Unable to write report: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
