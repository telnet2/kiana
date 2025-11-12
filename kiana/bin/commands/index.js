"use strict";
/**
 * Command exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMANDS = void 0;
// fs commands
const cat_1 = require("./fs/cat");
const ls_1 = require("./fs/ls");
const touch_1 = require("./fs/touch");
const rm_1 = require("./fs/rm");
const write_1 = require("./fs/write");
// directory commands
const pwd_1 = require("./directory/pwd");
const cd_1 = require("./directory/cd");
const mkdir_1 = require("./directory/mkdir");
// text commands
const echo_1 = require("./text/echo");
const grep_1 = require("./text/grep");
const sed_1 = require("./text/sed");
const diff_1 = require("./text/diff");
const patch_1 = require("./text/patch");
const jqn_1 = require("./text/jqn");
const wc_1 = require("./text/wc");
const head_1 = require("./text/head");
const tail_1 = require("./text/tail");
const cut_1 = require("./text/cut");
const sort_1 = require("./text/sort");
const uniq_1 = require("./text/uniq");
// util commands
const date_1 = require("./util/date");
const man_1 = require("./util/man");
const find_1 = require("./util/find");
const file_1 = require("./util/file");
const basename_1 = require("./util/basename");
const dirname_1 = require("./util/dirname");
// io commands
const import_1 = require("./io/import");
const export_1 = require("./io/export");
const node_1 = require("./io/node");
const vim_1 = require("./io/vim");
// net commands
const curl_1 = require("./io/curl");
// kiana command
const kiana_1 = require("./kiana");
exports.COMMANDS = {
    // fs commands
    cat: { execute: cat_1.cat, acceptsStdin: true },
    ls: { execute: ls_1.ls },
    touch: { execute: touch_1.touch },
    rm: { execute: rm_1.rm },
    write: { execute: write_1.write, acceptsStdin: true },
    // directory commands
    pwd: { execute: pwd_1.pwd },
    cd: { execute: cd_1.cd },
    mkdir: { execute: mkdir_1.mkdir },
    // text commands
    echo: { execute: echo_1.echo },
    grep: { execute: grep_1.grep, acceptsStdin: true },
    sed: { execute: sed_1.sed, acceptsStdin: true },
    diff: { execute: diff_1.diff },
    patch: { execute: patch_1.patch, acceptsStdin: true },
    jqn: { execute: jqn_1.jqn, acceptsStdin: true },
    wc: { execute: wc_1.wc, acceptsStdin: true },
    head: { execute: head_1.head, acceptsStdin: true },
    tail: { execute: tail_1.tail, acceptsStdin: true },
    cut: { execute: cut_1.cut, acceptsStdin: true },
    sort: { execute: sort_1.sort, acceptsStdin: true },
    uniq: { execute: uniq_1.uniq, acceptsStdin: true },
    // util commands
    date: { execute: date_1.date },
    man: { execute: man_1.man },
    find: { execute: find_1.find },
    file: { execute: file_1.file },
    basename: { execute: basename_1.basename },
    dirname: { execute: dirname_1.dirname },
    // io commands
    import: { execute: import_1.importCommand },
    export: { execute: export_1.exportCommand },
    node: { execute: node_1.node },
    vim: { execute: vim_1.vim },
    // net commands
    curl: { execute: curl_1.curl, acceptsStdin: true },
    // kiana command
    kiana: { execute: kiana_1.kiana },
};
