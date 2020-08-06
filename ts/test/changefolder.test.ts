import { suite, test } from "@testdeck/mocha";
import { equal } from 'assert';

import { execSync } from 'child_process';

import { loadXapian } from '../xapian/xapian.loader';
import { XapianAPI } from '../xapian/rmmxapianapi';
import { IndexingTools, MessageInfo } from '../xapian/messageinfo';
import { MailAddressInfo } from '../xapian/mailaddressinfo';

const XAPIANFSTYPE: string = 'MEM';

declare var FS, MEMFS, NODEFS;


const subjects = [
    'Weather1',
    'Weather2',
    'Weather3',
    'ÆØÅ nårsk',
    'Subject to be removed'
];

const contents = [
    'Sun is shining',
    'Cloudy',
    'A foggy day',
    'Været kunne vært bedre',
    'DeleteTest - this is a test'
];

/**
 * Change folder in xapian test
 */
@suite export class ChangeFolderTest {
    static before(done) {
        loadXapian().subscribe(() => {
            
            console.log('xapian loaded');
            
            FS.mkdir("/changefoldertest");
            FS.mount(MEMFS, {},"/changefoldertest");
            FS.chdir("/changefoldertest");

            done();
        });                        
    }

    static after() {
        if(XAPIANFSTYPE === 'NODE') {
            execSync('rm -Rf nodexapiantest');
        }
    }

    @test() createIndexPartitions() {        
        const xapian = new XapianAPI();
        const indexer : IndexingTools = new IndexingTools(xapian);

        xapian.initXapianIndex('otherpartition');
        for(let id = 1; id < 100; id++) {
            const msg = new MessageInfo(id, new Date(id * 6 * 60 * 60 * 1000),
                new Date(id * 6 * 60 * 60 * 1000),
                'Otherpartition',
                false,
                false,
                false,
                [new MailAddressInfo('Sender', 'sender@runbox.com')],
                [new MailAddressInfo('Receiver', 'receiver@runbox.com')],
                [],
                [],
                subjects[id % contents.length],
                contents[id % contents.length],
                100,
                false);
            indexer.addMessageToIndex(msg);                        
        }
        xapian.closeXapianDatabase();
        xapian.initXapianIndex('mainpartition');
        for(let id = 200; id < 300; id++) {
            const msg = new MessageInfo(id, new Date(id * 6 * 60 * 60 * 1000),
                new Date(id * 6 * 60 * 60 * 1000),
                'Mainpartition',
                false,
                false,
                false,
                [new MailAddressInfo('Sender', 'sender@runbox.com')],
                [new MailAddressInfo('Receiver', 'receiver@runbox.com')],
                [],
                [],
                subjects[id % contents.length],
                contents[id % contents.length],
                100,
                false);
            indexer.addMessageToIndex(msg);                        
        }
        xapian.commitXapianUpdates();
        xapian.addFolderXapianIndex('otherpartition');

        
    }
    
    @test() searchPartitions() {        
        const xapian = new XapianAPI();
        let results = xapian.sortedXapianQuery(`folder:"Mainpartition"`, 0, 0, 0, 100000, -1);

        equal(100, results.length);
        
        results = xapian.sortedXapianQuery(`folder:"Otherpartition"`, 0, 0, 0, 100000, -1);
        equal(99, results.length);
    }
    
    @test() changeFoldersInMainPartition() {        
        const xapian = new XapianAPI();
        let results = xapian.sortedXapianQuery(`folder:"Mainpartition"`, 0, 0, 0, 100000, -1);

       results.forEach((r) => {
           const docdata = xapian.getDocumentData(r[0]);
           const idterm = docdata.split("\t")[0];
           xapian.changeDocumentsFolder(idterm, 'Mainpartitionchanged');
       });

       xapian.commitXapianUpdates();
       results = xapian.sortedXapianQuery(`folder:"Mainpartition"`, 0, 0, 0, 100000, -1);
       equal(0, results.length);

       results = xapian.sortedXapianQuery(`folder:"Mainpartitionchanged"`, 0, 0, 0, 100000, -1);
       equal(100, results.length);       
    }
    
    @test() changeFoldersInOtherPartition() {        
        const xapian = new XapianAPI();
        let results = xapian.sortedXapianQuery(`folder:"Otherpartition"`, 0, 0, 0, 100000, -1);

       results.forEach((r) => {
           const docdata = xapian.getDocumentData(r[0]);
           const idterm = docdata.split("\t")[0];
           xapian.changeDocumentsFolder(idterm, 'Otherpartitionchanged');
       });

       xapian.commitXapianUpdates();
       results = xapian.sortedXapianQuery(`folder:"Otherpartition"`, 0, 0, 0, 100000, -1);
       equal(0, results.length);

       results = xapian.sortedXapianQuery(`folder:"Otherpartitionchanged"`, 0, 0, 0, 100000, -1);
       equal(99, results.length);       
    }

}
