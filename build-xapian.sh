#!/bin/bash
THREADS=${THREADS:-2}

wget https://oligarchy.co.uk/xapian/1.4.25/xapian-core-1.4.25.tar.xz
tar -xf xapian-core-1.4.25.tar.xz
cd xapian-core-1.4.25
emconfigure ./configure CPPFLAGS='-DFLINTLOCK_USE_FLOCK' CXXFLAGS='-Oz -s USE_ZLIB=1 -fno-rtti' --disable-backend-honey --disable-backend-inmemory --disable-shared --disable-backend-remote
emmake make -j$THREADS
cd ..
