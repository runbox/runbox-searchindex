import * as process from 'process';
import { AsyncSubject } from 'rxjs';

declare var FS;
declare var global;

let xapianLoadedSubject: AsyncSubject<boolean>;

export function loadXapian(): AsyncSubject<boolean> {
    if(!xapianLoadedSubject) {
        xapianLoadedSubject = new AsyncSubject();
        
        const xapian = require(`${process.cwd()}/dist/xapianasm.js`);
    
        global.termlistresult = [];
        global.Module = xapian;
        global.FS = xapian.FS;
        global.NODEFS = FS.filesystems.NODEFS;
        global.MEMFS = FS.filesystems.MEMFS;
        console.log("Xapian loaded");

        global.Module.onRuntimeInitialized = function() {
            console.log("Xapian runtime initialized");
            xapianLoadedSubject.next(true);
            xapianLoadedSubject.complete();        
        }        
    }
    return xapianLoadedSubject;
};
