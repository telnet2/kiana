import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Todo, TodoStore } from "./todo";

const ensureDir = async (path: string) => {
  await mkdir(path, { recursive: true });
};

const readJson = async <T>(path: string): Promise<T | undefined> => {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return undefined;
  }
  const text = await file.text();
  if (!text) return undefined;
  return JSON.parse(text) as T;
};

const writeJson = async (path: string, data: unknown) => {
  await ensureDir(dirname(path));
  const text = JSON.stringify(data, null, 2);
  await Bun.write(path, text);
};

export const createFileTodoStore = (baseDir = ".mycode/todo"): TodoStore => {
  const pathFor = (sessionId: string) => join(baseDir, `${sessionId}.json`);

  const load = async (sessionId: string) => {
    const todos = await readJson<ReadonlyArray<Todo>>(pathFor(sessionId));
    return todos ?? [];
  };

  const save = async (sessionId: string, todos: ReadonlyArray<Todo>) => {
    await writeJson(pathFor(sessionId), todos);
  };

  return { load, save };
};
