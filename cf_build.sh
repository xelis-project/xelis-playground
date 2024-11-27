#!/bin/bash

./build.sh

# Post build (append hash to files and output to /build folder)
npm i hash-web # cloudflare pages has npm pre-installed
./node_modules/.bin/hash-web ./public/index.html ./build
