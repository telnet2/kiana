# Wildcard Glob Support in MemShell

*Date: 2025-11-10*

## Overview

MemShell now supports comprehensive wildcard glob matching across most commands, enabling powerful bulk operations on files and directories. This document describes the wildcard capabilities, supported commands, and usage examples.

## Supported Wildcard Patterns

MemShell supports standard glob patterns:

- **`*`** - Matches any sequence of characters (except path separator)
- **`?`** - Matches any single character
- **`[abc]`** - Matches any single character in the brackets
- **`[a-z]`** - Matches any single character in the range
- **`{pattern1,pattern2}`** - Matches any of the comma-separated patterns

## Commands with Enhanced Wildcard Support

### 🔧 **Custom Wildcard Implementation**

These commands have been specifically enhanced with custom wildcard handling:

#### `import` Command
```bash
# Import all markdown files from real filesystem
import *.md docs/

# Import all JavaScript files from src directory
import src/*.js ./

# Import files starting with "report"
import report* ./reports/

# Import recursively with wildcards
import -r backup/*.tar backup/
```

#### `export` Command
```bash
# Export all markdown files to real filesystem
export *.md /tmp/output/

# Export all JavaScript files from src directory
export src/*.js /backup/code/

# Export files starting with "config"
export config* /tmp/configs/
```

#### `man` Command
```bash
# Show manuals for all import-related commands
man *import*

# Show manuals for all commands containing "ls"
man *ls*

# Show manuals for all 3-letter commands
man ???

# Show manuals for commands starting with "file"
man file*
```

### ✅ **Automatic Wildcard Support**

These commands automatically support wildcards through the shell's built-in expansion:

#### File Operations
```bash
# Display all text files
cat *.txt

# Count words in all markdown files
wc *.md

# Search for patterns across multiple files
grep "TODO" *.js

# Remove all log files
rm *.log

# Create/update multiple files
touch *.txt

# Process multiple JSON files
jqn '.name' data/*.json
```

#### Directory Operations
```bash
# Find all JavaScript files recursively
find . -name "*.js"

# Find files matching complex patterns
find . -name "test*.js" -type f
```

## How Wildcard Expansion Works

1. **Shell-Level Expansion**: Most commands automatically receive expanded file lists
2. **Custom Implementation**: Import/export/man use specialized wildcard handlers
3. **Pattern Matching**: Uses the `micromatch` library for robust pattern matching
4. **Directory Traversal**: Recursively searches directories for matching files

## Examples by Use Case

### 📁 **Bulk File Processing**
```bash
# Convert all markdown files to HTML (hypothetical)
# for file in *.md; do md2html "$file"; done

# Count lines in all source files
wc -l src/**/*.{js,ts,jsx,tsx}

# Search for errors across all log files
grep -i "error" logs/*.log
```

### 📊 **Data Analysis**
```bash
# Process all JSON data files
jqn '.[] | select(.status == "active")' data/*.json

# Extract specific fields from CSV files (hypothetical)
# jqn -r '.[].name' *.csv
```

### 🗂️ **File Management**
```bash
# Import all configuration files
import *.json config/
import *.yml config/
import *.yaml config/

# Export all documentation
export docs/*.md /backup/documentation/
export docs/images/* /backup/images/
```

### 🔍 **Documentation Lookup**
```bash
# Find all file-related commands
man *file*

# Find all text processing commands
man *text*
man *grep*
man *sed*

# Find all 4-letter commands
man ????
```

## Error Handling

Wildcard commands provide clear error messages:

```bash
# No files match pattern
$ export *.xyz /tmp/
export: No files match pattern: *.xyz

# Pattern matches but no manual entries
$ man *nonexistent*
No commands match pattern: *nonexistent*
```

## Performance Considerations

- **Large Directories**: Wildcards in large directories may take time to process
- **Recursive Operations**: Combine with `-r` flag for recursive directory operations
- **Memory Usage**: Very large file sets are processed efficiently

## Backward Compatibility

All wildcard enhancements maintain full backward compatibility:

```bash
# These continue to work exactly as before
import single-file.md docs/
export docs/readme.md /tmp/readme.md
man ls
```

## Implementation Details

### Import/Export Wildcard Processing
- Uses `handleWildcardImport()` and `handleWildcardExport()` functions
- Automatically creates destination directories
- Provides detailed feedback on processed files
- Handles mixed file types and directories

### Man Command Wildcard Processing
- Uses `handleWildcardMan()` function
- Matches against available command names
- Shows summaries for multiple matches
- Falls back to full manual for single matches

### Shell-Level Expansion
- Uses `MemShell.expandWildcards()` method
- Leverages `micromatch` library for pattern matching
- Handles complex patterns and edge cases
- Works transparently with existing commands

## Future Enhancements

Potential future wildcard improvements:
- **Extended Globbing**: Support for `**` (recursive) patterns
- **Exclusion Patterns**: Support for `!exclude` patterns
- **Case-Insensitive Matching**: Optional case-insensitive wildcards
- **Regular Expressions**: Advanced regex pattern support

## Troubleshooting

### Common Issues

1. **No files match pattern**
   - Verify files exist in the specified location
   - Check pattern syntax
   - Use `ls` to see available files

2. **Permission errors**
   - Ensure read access for import operations
   - Ensure write access for export operations

3. **Pattern too broad**
   - Use more specific patterns
   - Combine with file type filters

### Debug Commands

```bash
# See what files match a pattern
ls *.md
find . -name "pattern*"

# Test wildcard expansion
echo *.txt  # Shows expanded file list
```

## Conclusion

Wildcard support significantly enhances MemShell's usability for bulk operations, making it more efficient for file management, data processing, and documentation lookup. The implementation maintains backward compatibility while providing powerful new capabilities for users who need to work with multiple files simultaneously.