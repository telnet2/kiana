/**
 * man - Display manual pages for commands
 */

import { CommandContext } from '../types';
import { ArgumentParser } from 'argparse';
import micromatch = require('micromatch');

export function man(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'man',
        description: 'Display manual pages for commands (supports wildcards like *import*)',
        add_help: true
    });

    parser.add_argument('command', {
        nargs: '?',
        help: 'Command to show manual for (supports wildcards like *ls*, *import*)'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    const command = parsed.command;

    if (!command) {
        // List all available commands
        return getManIndex();
    }

    // Check if command contains wildcard patterns
    const hasWildcards = command.includes('*') || command.includes('?') || command.includes('[');
    
    if (hasWildcards) {
        // Handle wildcard pattern matching for commands
        return handleWildcardMan(command);
    } else {
        // Single command - existing logic
        const manPage = getManPage(command);
        if (!manPage) {
            return `No manual entry for ${command}`;
        }
        return manPage;
    }
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
  jqn        - process JSON with jq syntax
  wc         - count lines, words, and characters
  head       - output the first part of files
  tail       - output the last part of files
  cut        - remove sections from each line of files
  sort       - sort lines of text files
  uniq       - report or filter out repeated lines
  file       - determine file type
  basename   - strip directory and suffix from filenames
  dirname    - strip last component from file path
  write      - write text to a file
  import     - import file or directory from real filesystem
  export     - export file or directory to real filesystem
  node       - execute JavaScript file or code
  curl       - command-line tool for transferring data using URLs
  kiana      - LLM agent with memshell access

Use 'man <command>' to see detailed information about a command.`;
}

/**
 * Handle wildcard pattern matching for man commands
 */
function handleWildcardMan(pattern: string): string {
    // Get all available commands from man pages
    const allCommands = Object.keys(manPages);
    
    // Filter commands that match the pattern
    const matchingCommands = allCommands.filter(cmd => 
        micromatch.isMatch(cmd, pattern)
    );
    
    if (matchingCommands.length === 0) {
        return `No commands match pattern: ${pattern}`;
    }
    
    if (matchingCommands.length === 1) {
        // Single match - show the full manual page
        const manPage = getManPage(matchingCommands[0]);
        return manPage || `No manual entry for ${matchingCommands[0]}`;
    }
    
    // Multiple matches - show list of matching commands with their descriptions
    let result = `Commands matching pattern "${pattern}":\n\n`;
    
    for (const cmd of matchingCommands.sort()) {
        const manPage = getManPage(cmd);
        if (manPage) {
            // Extract the description from the man page (first line after NAME section)
            const lines = manPage.split('\n');
            const nameLine = lines.find(line => line.trim().startsWith(cmd + ' -'));
            const description = nameLine ? nameLine.replace(cmd + ' -', '').trim() : 'No description available';
            result += `  ${cmd.padEnd(12)} ${description}\n`;
        }
    }
    
    result += `\nUse 'man <command>' to see detailed information about a specific command.`;
    return result;
}

/**
 * Manual pages database
 */
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

        jqn: `NAME
       jqn - process JSON with jq syntax

SYNOPSIS
       jqn [OPTION]... [FILTER] [FILE]

DESCRIPTION
       Process JSON data using jq filter expressions. Supports reading
       from files or stdin, and provides various output formatting options.

POSITIONAL ARGUMENTS
       FILTER
              jq filter expression (default: "." for pretty-print)
              Examples: ".name", ".items[]", ".[] | select(.age > 18)"
       FILE
              JSON file to process (uses stdin if not provided)

OPTIONS
       -c, --compact
              Compact output (no pretty-printing)
       -r, --raw-output
              Output raw strings, not JSON texts
       -s, --slurp
              Read entire input stream into array
       -n, --null-input
              Use null as input value (no input required)
       -h, --help
              Display this help and exit

JQ FILTER BASICS
       .              Identity (return input unchanged)
       .foo           Get field "foo"
       .foo.bar       Nested field access
       .[]            Array/object iterator
       .[0]           Array index
       .foo, .bar     Multiple outputs
       | pipe         Pipe output to next filter
       select(expr)   Filter based on condition
       map(expr)      Apply expression to each element
       length         Get length of array/string/object
       keys           Get object keys
       values         Get object values
       sort           Sort array
       unique         Get unique elements
       group_by(expr) Group by expression

EXAMPLES
       echo '{"name":"John","age":30}' | jqn
              Pretty-print JSON

       echo '{"name":"John","age":30}' | jqn .name
              Output: "John"

       echo '{"name":"John","age":30}' | jqn -r .name
              Output: John (raw string, no quotes)

       echo '{"items":[1,2,3]}' | jqn '.items[]'
              Output each array element on separate line

       echo '{"items":[1,2,3]}' | jqn -c '.items | map(. * 2)'
              Output: [2,4,6]

       jqn '.users[] | select(.age > 18)' users.json
              Filter users older than 18 from file

       echo '{"a":1}' '{"b":2}' | jqn -s .
              Slurp: [{"a":1},{"b":2}]

       jqn << EOF
       {
         "name": "Alice",
         "email": "alice@example.com"
       }
       EOF
              Process JSON from HEREDOC

       jqn -n '{name: "test", value: 123}'
              Create JSON without input

FEATURES
       - Full jq syntax support
       - Stdin and file input
       - HEREDOC support
       - Multiple output formats
       - Array and object manipulation
       - Filtering and transformation

SEE ALSO
       grep, sed, cat
       Full jq documentation: https://stedolan.github.io/jq/`,

        wc: `NAME
       wc - print newline, word, and byte counts for files

SYNOPSIS
       wc [OPTION]... [FILE]...

DESCRIPTION
       Print newline, word, and byte counts for each FILE. With no FILE,
       read standard input. A word is a sequence of non-whitespace characters.

OPTIONS
       -c, --bytes
              Print the byte counts
       -m, --chars
              Print the character counts
       -l, --lines
              Print the line counts
       -w, --words
              Print the word counts
       -L, --max-line-length
              Print the maximum display width
       -h, --help
              Display this help and exit

OUTPUT FORMAT
       By default, the line count, word count, and byte count are printed
       for each file, followed by the filename (or nothing for stdin).
       If multiple files are given, a "total" line is printed.

EXAMPLES
       wc file.txt
              Print line, word, and byte counts

       wc -l file.txt
              Print line count only

       wc -w file.txt
              Print word count only

       wc -c file.txt
              Print byte count only

       wc -l *.txt
              Count lines in all .txt files

       cat file.txt | wc
              Count from stdin

       wc -L file.txt
              Print longest line length

       ls | wc -l
              Count files in directory (one per line)

SEE ALSO
       cat, grep, sed`,

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
       node - execute JavaScript file or code

SYNOPSIS
       node [OPTION]... (-e CODE | SCRIPT [ARGS]...)

DESCRIPTION
       Execute JavaScript file or code in sandboxed environment with MemFS access.

OPTIONS
       -e, --eval CODE
              Evaluate and execute JavaScript code directly
       --timeout=MS
              Set execution timeout in milliseconds
       --allow-eval
              Allow eval() in scripts (default: false)
       --allow-wasm
              Allow WebAssembly (default: false)
       --env KEY=VALUE
              Set environment variable
       -h, --help
              Display this help and exit

EXAMPLES
       node script.js
              Execute script.js

       node -e "console.log(1+1)"
              Execute inline code

       node --timeout=5000 script.js
              Execute with 5 second timeout

       node --env NODE_ENV=production app.js
              Set environment variable

SEE ALSO
       write, cat`,

        head: `NAME
       head - output the first part of files

SYNOPSIS
       head [OPTION]... [FILE]...

DESCRIPTION
       Print the first 10 lines of each FILE to standard output. With more than
       one FILE, precede each with a header giving the file name. If no FILE
       is given, read standard input.

OPTIONS
       -n, --lines NUM
              Print first NUM lines (default: 10)
       -c, --bytes NUM
              Print first NUM bytes
       -h, --help
              Display this help and exit

EXAMPLES
       head file.txt
              Print first 10 lines of file.txt

       head -n 5 file.txt
              Print first 5 lines

       head -c 100 file.txt
              Print first 100 bytes

       cat file.txt | head -n 3
              Print first 3 lines from stdin

SEE ALSO
       tail, cat, sed`,

        tail: `NAME
       tail - output the last part of files

SYNOPSIS
       tail [OPTION]... [FILE]...

DESCRIPTION
       Print the last 10 lines of each FILE to standard output. With more than
       one FILE, precede each with a header giving the file name. If no FILE
       is given, read standard input.

OPTIONS
       -n, --lines NUM
              Print last NUM lines (default: 10)
       -c, --bytes NUM
              Print last NUM bytes
       -h, --help
              Display this help and exit

EXAMPLES
       tail file.txt
              Print last 10 lines of file.txt

       tail -n 5 file.txt
              Print last 5 lines

       tail -c 50 file.txt
              Print last 50 bytes

       cat file.txt | tail -n 2
              Print last 2 lines from stdin

SEE ALSO
       head, cat, sed`,

        cut: `NAME
       cut - remove sections from each line of files

SYNOPSIS
       cut [OPTION]... [FILE]...

DESCRIPTION
       Print selected parts of lines from each FILE to standard output.
       With no FILE, read standard input.

OPTIONS
       -f, --fields FIELDS
              Select only these fields (e.g., 1,3 or 1-3)
       -d, --delimiter DELIM
              Use DELIM instead of TAB for field delimiter
       -c, --characters CHARS
              Select only these characters (e.g., 1,3 or 1-10)
       -h, --help
              Display this help and exit

EXAMPLES
       cut -f 1,3 data.txt
              Cut fields 1 and 3

       cut -d: -f1 /etc/passwd
              Extract usernames from passwd file

       cut -c 1-10 file.txt
              Extract first 10 characters

       echo "a:b:c" | cut -d: -f2
              Extract middle field from stdin

SEE ALSO
       grep, sed, awk`,

        sort: `NAME
       sort - sort lines of text files

SYNOPSIS
       sort [OPTION]... [FILE]...

DESCRIPTION
       Sort lines of text. With no FILE, read standard input.

OPTIONS
       -r, --reverse
              Reverse the result of comparisons
       -n, --numeric-sort
              Compare according to string numerical value
       -u, --unique
              Output only the first of an equal run
       -i, --ignore-case
              Ignore case differences when comparing
       -h, --help
              Display this help and exit

EXAMPLES
       sort file.txt
              Sort lines in file.txt

       sort -r file.txt
              Sort in reverse order

       sort -n numbers.txt
              Sort numerically

       cat file.txt | sort -u
              Sort and remove duplicates from stdin

SEE ALSO
       uniq, grep, sed`,

        uniq: `NAME
       uniq - report or filter out repeated lines in a file

SYNOPSIS
       uniq [OPTION]... [INPUT_FILE]

DESCRIPTION
       Filter adjacent matching lines from INPUT_FILE, writing to standard output.
       If no INPUT_FILE is given, read standard input. Note: uniq does not detect
       repeated lines unless they are adjacent.

OPTIONS
       -c, --count
              Prefix lines with the number of occurrences
       -d, --repeated
              Only output lines that are repeated in the input
       -u, --unique
              Only output lines that are not repeated in the input
       -i, --ignore-case
              Ignore case differences
       -f, --skip-fields NUM
              Skip first NUM fields when comparing
       -h, --help
              Display this help and exit

EXAMPLES
       uniq file.txt
              Filter repeated adjacent lines

       uniq -c file.txt
              Count occurrences of each line

       uniq -d file.txt
              Show only repeated lines

       sort file.txt | uniq
              Sort then filter (recommended for all duplicates)

       cat file.txt | uniq -u
              Show only unique lines from stdin

SEE ALSO
       sort, grep, sed`,

        file: `NAME
       file - determine file type

SYNOPSIS
       file [OPTION]... FILE...

DESCRIPTION
       Determine the type of each FILE. File tests the first few bytes of a file
       and prints a description of the file type.

OPTIONS
       -b, --brief
              Do not prepend filenames to output lines
       -h, --help
              Display this help and exit

EXAMPLES
       file test.txt
              Show file type

       file *.js
              Show type of all JavaScript files

       file -b test.json
              Show type without filename

SEE ALSO
       ls, cat`,

        basename: `NAME
       basename - strip directory and suffix from filenames

SYNOPSIS
       basename NAME [SUFFIX]

DESCRIPTION
       Print NAME with any leading directory components removed. If SUFFIX is
       specified, also remove the trailing SUFFIX.

EXAMPLES
       basename /tmp/test.txt
              Output: test.txt

       basename /tmp/test.txt .txt
              Output: test

       basename document.pdf
              Output: document.pdf

SEE ALSO
       dirname, ls`,

        dirname: `NAME
       dirname - strip last component from file path(s)

SYNOPSIS
       dirname PATH...

DESCRIPTION
       Print the directory portions of each PATH. For each PATH operand,
       the basename of the path is removed.

EXAMPLES
       dirname /tmp/test.txt
              Output: /tmp

       dirname /tmp/
              Output: /tmp

       dirname test.txt
              Output: .

       dirname /
              Output: .

SEE ALSO
       basename, ls`,

        curl: `NAME
       curl - command-line tool for transferring data using URLs

SYNOPSIS
       curl [OPTION]... [URL]

DESCRIPTION
       Transfer data from or to a server using URLs. Supports HTTP, HTTPS,
       FTP, and many other protocols. curl is a command-line wrapper around
       the system curl binary.

OPTIONS
       -X, --request METHOD
              Specify request method (GET, POST, PUT, DELETE, PATCH, etc.)
       -H, --header HEADER
              Pass custom header to server (can be used multiple times)
       -d, --data DATA
              Send specified data in request body
       -F, --form FIELD=VALUE
              Submit form field (use @file for file upload)
       -u, --user USERNAME[:PASSWORD]
              Authenticate with username and password
       -b, --cookie COOKIE
              Send cookie with request
       -c, --cookie-jar FILE
              Write cookies to FILE
       -o, --output FILE
              Write output to FILE instead of stdout
       -O, --remote-name
              Write output to file named as remote (from URL)
       -L, --location
              Follow redirects
       -i, --include
              Include response headers in output
       -I, --head
              Fetch headers only (HEAD request)
       -v, --verbose
              Enable verbose output for debugging
       -s, --silent
              Silent mode (no progress/error info)
       --data-raw DATA
              Send raw data (no special interpretation)
       -G, --get
              Use HTTP GET with -d data as query parameters
       -h, --help
              Display this help and exit

EXAMPLES
       curl http://example.com
              Fetch and display URL contents

       curl -X POST -d "key=value" http://api.example.com/endpoint
              POST form data

       curl -H "Content-Type: application/json" -d '{"key":"value"}' http://api.example.com
              POST JSON data with custom header

       curl -X GET "http://api.example.com/search?q=test"
              GET with query parameters

       curl -u username:password http://example.com
              Authenticate with basic auth

       curl -o output.html http://example.com
              Save response to file

       curl -L http://example.com
              Follow redirects

       curl -i http://example.com
              Include response headers in output

       curl -X DELETE http://api.example.com/resource/123
              Make DELETE request

       echo '{"data":"test"}' | curl -X POST -d @- http://api.example.com
              Pipe data to curl via stdin

FEATURES
       - Supports HTTP, HTTPS, FTP, and other protocols
       - Custom headers and authentication
       - Form data and file uploads
       - Cookie handling
       - Redirect following
       - Progress meter and verbose output

SEE ALSO
       wget, http, cat`,

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
       find, sed, diff, patch, jqn, write, node, import, export, http

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
       display a list of all available commands. Supports wildcards for
       pattern matching multiple commands.

WILDCARD SUPPORT
       man supports glob patterns for matching multiple commands:
       *     matches any sequence of characters
       ?     matches any single character
       [abc] matches any character in the brackets

EXAMPLES
       man
              List all available commands

       man ls
              Show manual for ls command

       man grep
              Show manual for grep command

       man *import*
              Show manuals for all import-related commands

       man *ls*
              Show manuals for all commands containing "ls"

       man ???
              Show manuals for all 3-letter commands

SEE ALSO
       help, --help flag on commands`
    };

/**
 * Get manual page for a specific command
 */
function getManPage(command: string): string | null {
    return manPages[command] || null;
}
