/**
 * man - Display manual pages for commands
 */

import { CommandContext } from '../types';
import { ArgumentParser } from 'argparse';

export function man(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'man',
        description: 'Display manual pages for commands',
        add_help: true
    });

    parser.add_argument('command', {
        nargs: '?',
        help: 'Command to show manual for'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    const command = parsed.command;

    if (!command) {
        // List all available commands
        return getManIndex();
    }

    const manPage = getManPage(command);
    if (!manPage) {
        return `No manual entry for ${command}`;
    }

    return manPage;
}

/**
 * Get index of all available manual pages
 */
function getManIndex(): string {
    return `MEMSHELL COMMAND MANUAL

Available commands:
  ls         - list directory contents
  cat        - concatenate and display files
  pwd        - print working directory
  cd         - change directory
  mkdir      - make directories
  touch      - create empty file or update timestamp
  rm         - remove files or directories
  echo       - display a line of text
  date       - display or set date and time
  man        - display manual pages
  diff       - compare files line by line
  grep       - search for patterns in files
  find       - search for files in directory hierarchy
  sed        - stream editor for filtering and transforming text
  patch      - apply a diff file to an original
  write      - write text to a file
  import     - import file or directory from real filesystem
  export     - export file or directory to real filesystem
  node       - execute JavaScript file
  kiana      - LLM agent with memshell access

Use 'man <command>' to see detailed information about a command.`;
}

/**
 * Get manual page for a specific command
 */
function getManPage(command: string): string | null {
    const manPages: Record<string, string> = {
        ls: `NAME
       ls - list directory contents

SYNOPSIS
       ls [OPTION]... [FILE]...

DESCRIPTION
       List information about files and directories.

OPTIONS
       -l     Use long listing format
       -a, --all
              Show hidden files (. and ..)
       -h, --help
              Display this help and exit

EXAMPLES
       ls
              List files in current directory

       ls -l
              List files with detailed information

       ls -a /tmp
              List all files including hidden in /tmp

SEE ALSO
       pwd, cd, find`,

        cat: `NAME
       cat - concatenate and display files

SYNOPSIS
       cat [OPTION]... [FILE]...

DESCRIPTION
       Concatenate FILE(s) to standard output. With no FILE, or when FILE
       is -, read standard input.

OPTIONS
       -n, --number
              Number all output lines
       -h, --help
              Display this help and exit

EXAMPLES
       cat file.txt
              Display contents of file.txt

       cat file1.txt file2.txt
              Display contents of both files

       cat -n file.txt
              Display file with line numbers

       echo "test" | cat
              Read from stdin

SEE ALSO
       echo, grep, sed`,

        pwd: `NAME
       pwd - print working directory

SYNOPSIS
       pwd

DESCRIPTION
       Print the full filename of the current working directory.

EXAMPLES
       pwd
              Display current directory path

SEE ALSO
       cd, ls`,

        cd: `NAME
       cd - change directory

SYNOPSIS
       cd [DIRECTORY]

DESCRIPTION
       Change the current working directory to DIRECTORY. If no DIRECTORY
       is given, change to root directory (/).

EXAMPLES
       cd /tmp
              Change to /tmp directory

       cd ..
              Go to parent directory

       cd
              Go to root directory

SEE ALSO
       pwd, ls, mkdir`,

        mkdir: `NAME
       mkdir - make directories

SYNOPSIS
       mkdir [OPTION]... DIRECTORY...

DESCRIPTION
       Create the DIRECTORY(ies), if they do not already exist.

OPTIONS
       -p, --parents
              Make parent directories as needed
       -h, --help
              Display this help and exit

EXAMPLES
       mkdir test
              Create directory 'test'

       mkdir -p /a/b/c
              Create nested directories

       mkdir dir1 dir2 dir3
              Create multiple directories

SEE ALSO
       cd, rm, ls`,

        touch: `NAME
       touch - create empty file or update timestamp

SYNOPSIS
       touch FILE...

DESCRIPTION
       Update the access and modification times of each FILE to the
       current time. Creates the file if it does not exist.

EXAMPLES
       touch file.txt
              Create empty file or update timestamp

       touch a.txt b.txt c.txt
              Create or update multiple files

SEE ALSO
       cat, write, rm`,

        rm: `NAME
       rm - remove files or directories

SYNOPSIS
       rm [OPTION]... FILE...

DESCRIPTION
       Remove (unlink) the FILE(s).

OPTIONS
       -r, -R, --recursive
              Remove directories and their contents recursively
       -f, --force
              Ignore nonexistent files, never prompt
       -h, --help
              Display this help and exit

EXAMPLES
       rm file.txt
              Remove file.txt

       rm -r directory
              Remove directory and its contents

       rm -rf /tmp/*
              Force remove everything in /tmp

SEE ALSO
       mkdir, touch, ls`,

        echo: `NAME
       echo - display a line of text

SYNOPSIS
       echo [STRING]...

DESCRIPTION
       Display the STRING(s) to standard output, separated by spaces.

EXAMPLES
       echo hello
              Output: hello

       echo hello world
              Output: hello world

       echo $(date)
              Output current date using command substitution

       echo "test" > file.txt
              Write to file using redirection

SEE ALSO
       cat, write`,

        date: `NAME
       date - display or set date and time

SYNOPSIS
       date [OPTION]... [+FORMAT]

DESCRIPTION
       Display the current date and time in the given FORMAT.

OPTIONS
       -u, --utc
              Display UTC time
       -I, --iso-8601
              Output ISO 8601 format
       -R, --rfc-email
              Output RFC 5322 format
       -h, --help
              Display this help and exit

FORMAT
       %Y     Year (4 digits)
       %m     Month (01-12)
       %d     Day (01-31)
       %H     Hour (00-23)
       %M     Minute (00-59)
       %S     Second (00-59)
       %a     Abbreviated weekday name
       %A     Full weekday name
       %b     Abbreviated month name
       %B     Full month name
       %s     Unix timestamp

EXAMPLES
       date
              Display current date and time

       date --iso-8601
              Output: 2025-10-31T21:27:42.365Z

       date +%Y-%m-%d
              Output: 2025-10-31

       date +%H:%M:%S
              Output: 21:27:42

       echo "Report: $(date +%Y-%m-%d)" > report.txt
              Use in command substitution

SEE ALSO
       echo, write`,

        grep: `NAME
       grep - search for patterns in files

SYNOPSIS
       grep [OPTION]... PATTERN [FILE]...

DESCRIPTION
       Search for PATTERN in each FILE. If no FILE is given, read
       standard input. PATTERN is a regular expression.

OPTIONS
       -e PATTERN, --regexp=PATTERN
              Use PATTERN as the pattern (can be used multiple times)
       -i, --ignore-case
              Ignore case distinctions
       -n, --line-number
              Prefix each line with line number
       -v, --invert-match
              Select non-matching lines
       -h, --no-filename
              Suppress file name prefix
       -A NUM, --after-context=NUM
              Print NUM lines of trailing context
       -B NUM, --before-context=NUM
              Print NUM lines of leading context
       -C NUM, --context=NUM
              Print NUM lines of context
       --help
              Display this help and exit

EXAMPLES
       grep error log.txt
              Search for "error" in log.txt

       grep -i error log.txt
              Case-insensitive search

       grep -n "TODO" *.txt
              Show line numbers for matches

       cat file.txt | grep pattern
              Search in piped input

SEE ALSO
       sed, find, cat`,

        find: `NAME
       find - search for files in directory hierarchy

SYNOPSIS
       find [PATH] [OPTION]...

DESCRIPTION
       Search for files in a directory hierarchy.

OPTIONS
       -name PATTERN
              Base of file name matches PATTERN (wildcards allowed)
       -type TYPE
              File type: f (file), d (directory), l (link)
       -maxdepth NUM
              Maximum directory depth
       -h, --help
              Display this help and exit

EXAMPLES
       find .
              List all files/directories recursively

       find . -name "*.txt"
              Find all .txt files

       find /tmp -type f
              Find all files (not directories)

       find . -name "test*" -type d
              Find directories starting with "test"

SEE ALSO
       ls, grep, locate`,

        sed: `NAME
       sed - stream editor for filtering and transforming text

SYNOPSIS
       sed [OPTION]... SCRIPT [FILE]

DESCRIPTION
       Perform basic text transformations on FILE or stdin.

OPTIONS
       -e SCRIPT, --expression=SCRIPT
              Add the script to the commands to be executed
       -i, --in-place
              Edit files in place
       -n, --quiet, --silent
              Suppress automatic printing of pattern space
       -h, --help
              Display this help and exit

SCRIPT FORMAT
       s/PATTERN/REPLACEMENT/[FLAGS]
              Substitute PATTERN with REPLACEMENT
              FLAGS: g (global), i (case-insensitive), p (print)

EXAMPLES
       sed 's/old/new/g' file.txt
              Replace all "old" with "new"

       sed -i 's/foo/bar/' file.txt
              Replace in-place

       echo "test" | sed 's/t/T/g'
              Replace in piped input

SEE ALSO
       grep, awk, tr`,

        diff: `NAME
       diff - compare files line by line

SYNOPSIS
       diff [OPTION]... FILE1 FILE2

DESCRIPTION
       Compare FILE1 and FILE2 line by line.

OPTIONS
       -u, --unified
              Output 3 lines of unified context
       -U NUM
              Output NUM lines of unified context
       -c, --context
              Output 3 lines of copied context
       -C NUM
              Output NUM lines of copied context
       -q, --brief
              Report only when files differ
       -i, --ignore-case
              Ignore case differences
       -w, --ignore-all-space
              Ignore all white space
       -b, --ignore-space-change
              Ignore changes in the amount of white space
       -B, --ignore-blank-lines
              Ignore changes whose lines are all blank
       -h, --help
              Display this help and exit

EXAMPLES
       diff file1.txt file2.txt
              Show differences

       diff -u old.txt new.txt
              Unified diff format

       diff -q file1 file2
              Check if files differ

SEE ALSO
       patch, cmp, comm`,

        patch: `NAME
       patch - apply a diff file to an original

SYNOPSIS
       patch [OPTION]... [FILE]

DESCRIPTION
       Apply a diff file to an original. Supports unified, context,
       and normal diff formats.

OPTIONS
       -p NUM, --strip=NUM
              Strip NUM leading path components from filenames
       -R, --reverse
              Apply patch in reverse
       -o FILE, --output=FILE
              Output to FILE instead of patching in-place
       -i PATCHFILE, --input=PATCHFILE
              Read patch from PATCHFILE instead of stdin
       -h, --help
              Display this help and exit

EXAMPLES
       patch -i changes.patch file.txt
              Apply patch to file

       diff -u old.txt new.txt > changes.patch
       patch -i changes.patch old.txt
              Create and apply patch

       patch -R -i changes.patch
              Reverse a patch

SEE ALSO
       diff, merge`,

        write: `NAME
       write - write text to a file

SYNOPSIS
       write FILE CONTENT...

DESCRIPTION
       Write CONTENT to FILE. Creates the file if it doesn't exist,
       overwrites if it does.

EXAMPLES
       write test.txt hello world
              Write "hello world" to test.txt

       write data.txt $(date)
              Write current date to file

SEE ALSO
       echo, cat, touch`,

        import: `NAME
       import - import file or directory from real filesystem

SYNOPSIS
       import [OPTION]... SOURCE [DESTINATION]

DESCRIPTION
       Import file or directory from the real filesystem into MemFS.

OPTIONS
       -r, -R, --recursive
              Import directories recursively
       -h, --help
              Display this help and exit

EXAMPLES
       import /tmp/file.txt
              Import file to current directory

       import -r /tmp/mydir
              Import directory recursively

SEE ALSO
       export, cp`,

        export: `NAME
       export - export file or directory to real filesystem

SYNOPSIS
       export SOURCE DESTINATION

DESCRIPTION
       Export file or directory from MemFS to the real filesystem.

EXAMPLES
       export test.txt /tmp/test.txt
              Export file to real filesystem

       export /mydir /tmp/backup
              Export directory

SEE ALSO
       import, cp`,

        node: `NAME
       node - execute JavaScript file

SYNOPSIS
       node [OPTION]... SCRIPT [ARGS]...

DESCRIPTION
       Execute JavaScript file in sandboxed environment with MemFS access.

OPTIONS
       --timeout=MS
              Set execution timeout in milliseconds
       --allow-eval
              Allow eval() in scripts (default: false)
       --allow-wasm
              Allow WebAssembly (default: false)
       -e KEY=VALUE, --env KEY=VALUE
              Set environment variable
       -h, --help
              Display this help and exit

EXAMPLES
       node script.js
              Execute script.js

       node --timeout=5000 script.js
              Execute with 5 second timeout

       node -e NODE_ENV=production app.js
              Set environment variable

SEE ALSO
       write, cat`,

        kiana: `NAME
       kiana - LLM agent with memshell access

SYNOPSIS
       kiana [OPTION]... [INSTRUCTION]

DESCRIPTION
       AI-powered agent that can execute shell commands to complete tasks.
       Uses OpenAI API and the memfs_exec tool.

OPTIONS
       --instruction=TEXT
              Task instruction (text or file path in MemFS)
       --system-prompt=FILE
              System prompt file path in MemFS
       --model=MODEL
              OpenAI model to use (default: gpt-4o-mini)
       --max-rounds=NUM
              Maximum tool-call rounds (default: 20)
       --verbose
              Enable verbose logging
       -h, --help
              Display this help and exit

EXAMPLES
       kiana "Create a hello.txt file"
              Execute task with inline instruction

       kiana --instruction task.txt
              Read instruction from MemFS file

       kiana --verbose "List all files"
              Run with debug output

       kiana --model=gpt-4o "Complex task"
              Use different model

AVAILABLE COMMANDS
       The agent can use any MemShell command including:
       ls, cat, pwd, cd, mkdir, touch, rm, echo, date, grep,
       find, sed, diff, patch, write, node, import, export

FEATURES
       - Command substitution: $(command)
       - Pipes: cmd1 | cmd2
       - Redirections: cmd > file, cmd >> file
       - Operators: cmd1 && cmd2, cmd1 || cmd2

ENVIRONMENT
       Requires OPENAI_API_KEY environment variable.

SEE ALSO
       All MemShell commands`,

        man: `NAME
       man - display manual pages

SYNOPSIS
       man [COMMAND]

DESCRIPTION
       Display the manual page for COMMAND. If no COMMAND is given,
       display a list of all available commands.

EXAMPLES
       man
              List all available commands

       man ls
              Show manual for ls command

       man grep
              Show manual for grep command

SEE ALSO
       help, --help flag on commands`
    };

    return manPages[command] || null;
}
