const execSync = require('child_process').execSync;

if(!process.env.XAPIAN) {
  console.error("Environment variable XAPIAN must be set to the location of xapian_core");
} else {
  try {
    console.log('Building Runbox Xapian webassembly library');
    execSync(`em++ -Oz -s DISABLE_EXCEPTION_CATCHING=0 -s USE_ZLIB=1 ` + 
      `-s "EXTRA_EXPORTED_RUNTIME_METHODS=['FS','cwrap','stringToUTF8','UTF8ToString','getValue']" ` +
      `-std=c++11 -s DEMANGLE_SUPPORT=1 -s ALLOW_MEMORY_GROWTH=1 ` +
      `-I$XAPIAN/include -I$XAPIAN -I$XAPIAN/common rmmxapianapi.cc $XAPIAN/.libs/libxapian-1.5.a ` +
      `-o xapianasm.js`, { stdio: 'inherit' });
    console.log('Successful build of xapianasm.wasm and xapianasm.js');
  } catch(e) {
    console.error('Compile failed');
  }
}

