/**
 * Command exports
 */

import { CommandDefinition, CommandContext } from './types';

// fs commands
import { cat } from './fs/cat';
import { ls } from './fs/ls';
import { touch } from './fs/touch';
import { rm } from './fs/rm';
import { write } from './fs/write';

// directory commands
import { pwd } from './directory/pwd';
import { cd } from './directory/cd';
import { mkdir } from './directory/mkdir';

// text commands
import { echo } from './text/echo';
import { grep } from './text/grep';
import { sed } from './text/sed';
import { diff } from './text/diff';
import { patch } from './text/patch';
import { jqn } from './text/jqn';
import { wc } from './text/wc';

// util commands
import { date } from './util/date';
import { man } from './util/man';
import { find } from './util/find';

// io commands
import { importCommand } from './io/import';
import { exportCommand } from './io/export';
import { node } from './io/node';

// net commands
import { curl } from './io/curl';

// kiana command
import { kiana } from './kiana';

export const COMMANDS: Record<string, CommandDefinition> = {
    // fs commands
    cat: { execute: cat, acceptsStdin: true },
    ls: { execute: ls },
    touch: { execute: touch },
    rm: { execute: rm },
    write: { execute: write, acceptsStdin: true },

    // directory commands
    pwd: { execute: pwd },
    cd: { execute: cd },
    mkdir: { execute: mkdir },

    // text commands
    echo: { execute: echo },
    grep: { execute: grep, acceptsStdin: true },
    sed: { execute: sed, acceptsStdin: true },
    diff: { execute: diff },
    patch: { execute: patch, acceptsStdin: true },
    jqn: { execute: jqn, acceptsStdin: true },
    wc: { execute: wc, acceptsStdin: true },

    // util commands
    date: { execute: date },
    man: { execute: man },
    find: { execute: find },

    // io commands
    import: { execute: importCommand },
    export: { execute: exportCommand },
    node: { execute: node },

    // net commands
    curl: { execute: curl, acceptsStdin: true },

    // kiana command
    kiana: { execute: kiana },
};

export { CommandContext, CommandDefinition, CommandFunction } from './types';
