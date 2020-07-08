#!/bin/bash
THREADS=${THREADS:-2}

git clone https://github.com/xapian/xapian
cd xapian
git checkout v1.4.16
./bootstrap xapian-core
./configure CXXFLAGS=-O0 --disable-backend-honey --disable-backend-inmemory --disable-backend-remote
make -j$THREADS
make -j$THREADS distclean
cd xapian-core
emconfigure ./configure CPPFLAGS='-DFLINTLOCK_USE_FLOCK' CXXFLAGS='-Oz -s USE_ZLIB=1 -fno-rtti' --disable-backend-honey --disable-backend-inmemory --disable-shared --disable-backend-remote
emmake make -j$THREADS
cd ../..
