#!/usr/bin/env bash
if [ "$1" == "release" ]
then
    emcc -O2 seagull.c -o seagull.js -s EXPORT_ES6=1 -s MODULARIZE=1 -s ALLOW_MEMORY_GROWTH -Wall -Wextra -pedantic -Werror
else
    emcc seagull.c -o seagull.js -s EXPORT_ES6=1 -s MODULARIZE=1 -s ALLOW_MEMORY_GROWTH -s -Wall -Wextra -pedantic -Werror
fi