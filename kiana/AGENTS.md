# Adding a REPL command

- Implement the command in `src/commands/<category>/<command>.ts`
- Add the command to the `commands` array in `MemTools.ts`
- Add the command to the `showHelp` method in `MemREPL.ts`
- Add the command to the `getOpenAIToolDefinition` method in `MemTools.ts`
- Add the command to the `man.ts` file
- Add the command to the DEFAULT_SYSTEM_PROMPT in `src/KianaAgent.ts`