import JSZip from 'jszip';
import { MemDirectory, MemFile } from '@byted/kiana/src/MemFS';

export async function zipMemDir(root: MemDirectory): Promise<Buffer> {
  const zip = new JSZip();

  const addNode = (dir: MemDirectory, base: string) => {
    for (const child of dir.children.values()) {
      if (child.isFile()) {
        zip.file(`${base}${child.name}`, (child as MemFile).read());
      } else if (child.isDirectory()) {
        const sub = `${base}${child.name}/`;
        zip.folder(sub);
        addNode(child, sub);
      }
    }
  };

  addNode(root, '');
  return await zip.generateAsync({ type: 'nodebuffer' });
}
