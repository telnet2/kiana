#!/bin/bash

echo "=== Testing wildcards in MemFS ==="

# Create files in MemFS first
/Users/joohwi.lee/crystal/kiana/kiana/bin/memsh -c '
write file1.txt "content of file 1"
write file2.txt "content of file 2"
write file3.txt "content of file 3"
write test.md "markdown content"
ls
'

echo ""
echo "=== Test 1: cat *.txt ==="
/Users/joohwi.lee/crystal/kiana/kiana/bin/memsh -c 'cat *.txt'

echo ""
echo "=== Test 2: grep content *.txt ==="
/Users/joohwi.lee/crystal/kiana/kiana/bin/memsh -c 'grep content *.txt'

echo ""
echo "=== Test 3: wc *.txt ==="
/Users/joohwi.lee/crystal/kiana/kiana/bin/memsh -c 'wc *.txt'

echo ""
echo "=== Test 4: rm *.txt ==="
/Users/joohwi.lee/crystal/kiana/kiana/bin/memsh -c 'ls'
/Users/joohwi.lee/crystal/kiana/kiana/bin/memsh -c 'rm *.txt'
/Users/joohwi.lee/crystal/kiana/kiana/bin/memsh -c 'ls'