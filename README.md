[![Build Status](https://api.travis-ci.com/runbox/runbox-searchindex.svg?branch=master)](https://travis-ci.com/runbox/runbox-searchindex)

Runbox searchindex - for searching and indexing emails in the browser or node.js
================================================================================

This library enables a full featured search index in your browser, and is used in [Runbox 7](https://blog.runbox.com/2019/01/the-secret-behind-runbox-7s-speed/) for searching emails without interacting with a server.

It is based on [Xapian](https://xapian.org) which is an open source search engine library written in C. By compiling Xapian with the [Emscripten](https://emscripten.org/) compiler we are able to build this library for [WebAssembly](https://webassembly.org/) which runs in modern browsers.

By targeting WebAssembly we are also able to use the same code on the server with nodejs. We don't need to create separate builds for different operating systems. Also since it runs inside the Javascript sandbox we can benefit from
the security features that comes with it. We believe this is both safer and more portable than native builds, without
loosing much when it comes to performance. Rather we've seen gain in development productivity and even performance by such tight integration with the Javascript runtime that comes with WebAssembly, compared to using traditional script language bindings to C libraries.

Having the search index in the browser would of course not work for a search engine for the entire web, but for
an email account there's a limited amount of data where the search index could fit in the browsers local storage engine such as IndexedDB and even in memory when in use.

There are several benefits of having a search index in the browser rather than on the server. First of all it's the
gain in speed since you don't have the roundtrip of query and results to the server. You can return complete 
search results instantly as you type, and you can offer more features when it comes to sorting and counting the 
number of hits. For the user this means that you can be more efficient in adjusting your query since you get such
instant results. Another benefit is that no server will monitor what you are searching, which is good for privacy. 
You can also search your content when offline (without internet connection). If the user even has coding skills, having full access to the search-index and the libraries to interact with it opens up possibilities for custom-processing of the index. In an email scenario that could be everything from smart searches to surveillance and alerts.

Still there are cases where you don't want to download the searchindex, and you want to use the server for search. One scenario might be when using a device that is not your own. Targeting WebAssembly makes it possible to reuse the same code on the server to provide the same API's as in the browser.

Modern web applications makes more and more use of the browsers local storage for cache, storing settings, content and more. This gives us better performance and even offline capabilities, but also require more awareness of what browser and device we use. When not using your own private device, you should use private browsing so that nothing is stored on that device. Also for your private devices you should consider using an operating system that offers encrypted file systems.

## How to build
This project depends on https://github.com/xapian/xapian and that you have built it using Emscripten as written here:

https://github.com/xapian/xapian/blob/master/xapian-core/emscripten/README.md

In order to build the web assembly binaries you will have to set the `XAPIAN` environment variable to
the location of the `xapian_core` folder of your Xapian emscripten build.

You may then build it using `npm run build --xapiandir=xapian_core_location`

You can also have a look at the [Github CI](.github/workflows/ci.yml) file for a complete build and test procedure (which is run on every push).

## Running tests

`npm run test`
