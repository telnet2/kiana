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
import { head } from './text/head';
import { tail } from './text/tail';
import { cut } from './text/cut';
import { sort } from './text/sort';
import { uniq } from './text/uniq';
import { tr } from './text/tr';

// util commands
import { date } from './util/date';
import { man } from './util/man';
import { find } from './util/find';
import { file } from './util/file';
import { basename } from './util/basename';
import { dirname } from './util/dirname';
import { tee } from './util/tee';
import { xargs } from './util/xargs';

// io commands
import { importCommand } from './io/import';
import { exportCommand } from './io/export';
import { node } from './io/node';
import { vim } from './io/vim';

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
    head: { execute: head, acceptsStdin: true },
    tail: { execute: tail, acceptsStdin: true },
    cut: { execute: cut, acceptsStdin: true },
    sort: { execute: sort, acceptsStdin: true },
    uniq: { execute: uniq, acceptsStdin: true },
    tr: { execute: tr, acceptsStdin: true },

    // util commands
    date: { execute: date },
    man: { execute: man },
    find: { execute: find },
    file: { execute: file },
    basename: { execute: basename },
    dirname: { execute: dirname },
    tee: { execute: tee, acceptsStdin: true },
    xargs: { execute: xargs, acceptsStdin: true },

    // io commands
    import: { execute: importCommand },
    export: { execute: exportCommand },
    node: { execute: node },
    vim: { execute: vim },

    // net commands
    curl: { execute: curl, acceptsStdin: true },

    // kiana command
    kiana: { execute: kiana },
};

export { CommandContext, CommandDefinition, CommandFunction } from './types';
