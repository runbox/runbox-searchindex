#!/bin/bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install 1.39.19
./emsdk activate 1.39.19
cd ..
