import { suite, test, timeout } from "@testdeck/mocha";
import { equal, notEqual, ok } from 'assert';

import { existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

import { loadXapian } from '../xapian/xapian.loader';
import { XapianAPI } from '../xapian/rmmxapianapi';
import { IndexingTools, MessageInfo } from '../xapian/messageinfo';
import { MailAddressInfo } from '../xapian/mailaddressinfo';

const XAPIANFSTYPE: string = 'MEM';
// const XAPIANFSTYPE: string = 'NODE';

declare var FS, MEMFS, NODEFS;


const totalMessages = 20000;
const initialSeenMessages = 1234;
const messages: MessageInfo[] = [];
const messagesById: {[id: number]: MessageInfo} = {};


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
 * Example test suite creating an example library.
 */
@suite export class XapianTest {
    static before(done) {
        loadXapian().subscribe(() => {
            
            console.log('xapian loaded');
            if(XAPIANFSTYPE === 'NODE') {
                if(existsSync('nodexapiantest')) {
                    execSync('rm -Rf nodexapiantest');
                }
                mkdirSync('nodexapiantest');
                FS.mkdir("/work");                
                FS.mount(NODEFS, {root: './nodexapiantest'},"/work");
                FS.chdir("/work");             
            } else {
                FS.mkdir("/work");
                FS.mount(MEMFS, {},"/work");
                FS.chdir("/work");
            }
            done();
        });                        
    }

    static after() {
        if(XAPIANFSTYPE === 'NODE') {
            execSync('rm -Rf nodexapiantest');
        }
    }

    @test() createIndex() {        
        const xapian = new XapianAPI();
        xapian.initXapianIndex('mainpartition');
        
    }

    @test() createMessages() {        
        console.log('creating',totalMessages,'messages');
        for(let id = 1; id < (totalMessages + 1); id++) {
            const msg = new MessageInfo(id, new Date(id * 6 * 60 * 60 * 1000),
                new Date(id * 6 * 60 * 60 * 1000),
                'Inbox',
                (id <= initialSeenMessages),
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
            messages.push(msg);
            messagesById[id] = msg;
        }       
        equal(totalMessages, messages.length); 
    }
    
    @test(timeout(30000)) addMessages() {
        const xapian = new XapianAPI();
        const indexer : IndexingTools = new IndexingTools(xapian);
        messages.forEach((msg, ndx) => {
            indexer.addMessageToIndex(msg);
            if(ndx % 500 === 0) {
                console.log('added messages', ndx, 'of', messages.length);
            }
        });        
    }

    @test() hasMessageId() {
        const xapian = new XapianAPI();
        equal(xapian.hasMessageId(0), false);
        equal(xapian.hasMessageId(1), true);
        equal(xapian.hasMessageId(30), true);
        equal(xapian.hasMessageId(333333), false);
        equal(xapian.hasMessageId(totalMessages), true);
        equal(xapian.hasMessageId(totalMessages + 1), false);
    }

    @test() getFolder() {
        const xapian = new XapianAPI();
        const documentXTermList: (docid: number) => number = global['Module'].cwrap('documentXTermList', 'number', ['number']);
        const termcount = documentXTermList(30);
        
        global['Module']['documenttermlistresult']
        equal(global['Module']['documenttermlistresult'].length, 6);
        equal(global['Module']['documenttermlistresult']
            .find(term => term.indexOf('XFOLDER:Inbox') === 0) ? true : false, true);
    }

    @test() searchMessages() {
        const xapian = new XapianAPI();
        const maxresults = 20;
        const results = xapian.sortedXapianQuery('Været', 0, 0, 0, maxresults, -1);
        equal(maxresults, results.length);
        results.forEach((r) => {
            const docdata = xapian.getDocumentData(r[0]);
            console.log(
                xapian.getStringValue(r[0], 0),
                xapian.getStringValue(r[0], 1),
                xapian.getStringValue(r[0], 2),
                docdata
            );
            const dparts = docdata.split('\t');
            const id = parseInt(dparts[0].substring(1), 10);
            const subject = dparts[2];
            equal(messagesById[id].subject, subject);
        });
    }

    @test(timeout(10000)) moveMessages() {
        const xapian = new XapianAPI();

        let results = xapian.sortedXapianQuery(`Været AND folder:"TestFolder"`, 0, 0, 0, 100000, -1);
        equal(0, results.length);
        
        const indexer : IndexingTools = new IndexingTools(xapian);
        const maxresults = 1000;
        results = xapian.sortedXapianQuery('Været', 0, 0, 0, maxresults, -1);

        equal(maxresults, results.length);
        results.forEach((r, ndx) => {
            const docdata = xapian.getDocumentData(r[0]);
            const dparts = docdata.split('\t');
            const id = parseInt(dparts[0].substring(1), 10);
            messagesById[id].folder = 'Testfolder';
            indexer.addMessageToIndex(messagesById[id]);
            if(ndx%500 === 0) {
                console.log('moved', ndx, 'messages to Testfolder');
            }            
        });

        xapian.commitXapianUpdates();
        results = xapian.sortedXapianQuery(`Været AND folder:"Testfolder"`, 0, 0, 0, 100000, -1);
        equal(maxresults, results.length);
        
        results.forEach((r) => {
            const docdata = xapian.getDocumentData(r[0]);
            
            const dparts = docdata.split('\t');
            const id = parseInt(dparts[0].substring(1), 10);
            const subject = dparts[2];
            equal(messagesById[id].subject, subject);
        });
    }

    @test() folderMessageCounters() {
        const xapian = new XapianAPI();

        const [fastTotal, fastUnread] = xapian.getFolderMessageCounts('Testfolder');
        const sortedUnread = xapian.sortedXapianQuery(`folder:"Testfolder" AND NOT flag:seen`, 0, 0, 0, 100000, -1).length;
        const sortedTotal  = xapian.sortedXapianQuery(`folder:"Testfolder"`, 0, 0, 0, 100000, -1).length;

        console.log(fastTotal, fastUnread, sortedTotal, sortedUnread);

        notEqual(sortedTotal, sortedUnread); // make sure this test makes sense
        equal(fastUnread, sortedUnread);
        equal(fastTotal, sortedTotal);
    }

    @test(timeout(10000)) folderMessageCounterBenchmark() {
        const xapian = new XapianAPI();
        const iterations = 1_000;

        console.log("Checking using sortedXapianQuery...");
        const timestamp = (): number => (new Date()).getTime();
        let t1 = timestamp();
        for (let i = 0; i < iterations; i++) {
            xapian.sortedXapianQuery(`folder:"Testfolder" AND NOT flag:seen`, 0, 0, 0, 100000, -1).length;
            xapian.sortedXapianQuery(`folder:"Testfolder"`, 0, 0, 0, 100000, -1).length;
        }

        const sortedQueryTime = timestamp() - t1;
        console.log(`sortedXapianQuery runtime: ${sortedQueryTime}ms (${sortedQueryTime / iterations}ms per query)`);

        console.log("Checking using getFolderMessageCounts...");
        t1 = timestamp();
        for (let i = 0; i < iterations; i++) {
            xapian.getFolderMessageCounts('Testfolder');
        }
        const getFolderMessageCountsTime = timestamp() - t1;
        console.log(`getFolderMessageCounts runtime: ${getFolderMessageCountsTime}ms (${getFolderMessageCountsTime / iterations}ms per query)`);
        ok(sortedQueryTime >  (2 * getFolderMessageCountsTime), 'getFolderMessageCounts() is noticably faster than using sortedXapianQuery()');
    }

    @test(timeout(10000)) moveMessages2() {
        const xapian = new XapianAPI();

        let results = xapian.sortedXapianQuery(`Været AND folder:"TestChangeFolder"`, 0, 0, 0, 100000, -1);
        equal(0, results.length);                        

        const indexer : IndexingTools = new IndexingTools(xapian);
        const maxresults = 1000;
        results = xapian.sortedXapianQuery(`Været AND folder:"Testfolder"`, 0, 0, 0, 100000, -1);

        equal(maxresults, results.length);
        results.forEach((r, ndx) => {
            const docdata = xapian.getDocumentData(r[0]);
            const dparts = docdata.split('\t');
            
            xapian.changeDocumentsFolder(dparts[0], 'TestChangeFolder');
            if(ndx%500 === 0) {
                console.log('moved', ndx, 'messages to TestChangeFolder');
            }            
        });

        xapian.commitXapianUpdates();

        results = xapian.sortedXapianQuery(`Været AND folder:"Testfolder"`, 0, 0, 0, 100000, -1);
        equal(0, results.length);

        results = xapian.sortedXapianQuery(`Været AND folder:"TestChangeFolder"`, 0, 0, 0, 100000, -1);
        equal(maxresults, results.length);
                
        results.forEach((r) => {
            const docdata = xapian.getDocumentData(r[0]);
            
            const dparts = docdata.split('\t');
            const id = parseInt(dparts[0].substring(1), 10);
            const subject = dparts[2];
            equal(messagesById[id].subject, subject);

            // Change back to Testfolder
            xapian.changeDocumentsFolder(dparts[0], 'Testfolder');
        });
        xapian.commitXapianUpdates();
    }

    @test(timeout(20000)) deleteMessages() {
        const xapian = new XapianAPI();

        const deleteTerm = 'DeleteTest';
        let results = xapian.sortedXapianQuery(deleteTerm, 0, 0, 0, 100000, -1);
        const expectedLength = messages.filter(msg => msg.plaintext.indexOf(deleteTerm) > -1).length;
        console.log('expected number of results to delete', expectedLength);
        equal(expectedLength, results.length);
                
        
        results.forEach((r, ndx) => {
            const docdata = xapian.getDocumentData(r[0]);
            const dparts = docdata.split('\t');            
            
            const id = parseInt(dparts[0].substring(1), 10);
            equal(xapian.hasMessageId(id), true);
            
            xapian.deleteDocumentByUniqueTerm('Q' + id);

            equal(xapian.hasMessageId(id), false);

            if(ndx%100 === 0) {
                console.log('deleted', ndx, 'messages');
            }            
        });

        results = xapian.sortedXapianQuery(deleteTerm, 0, 0, 0, 100000, -1);
        equal(0, results.length);            
    }

    @test(timeout(5000)) compact() {
        const xapian = new XapianAPI();
        xapian.commitXapianUpdates();
        xapian.compactDatabase();
        xapian.closeXapianDatabase();
        console.log('Created compact database');
    }

    @test(timeout(20000)) openwithcompactpartition() {
        const xapian = new XapianAPI();
        xapian.initXapianIndex('test');
        xapian.addSingleFileXapianIndex('xapianglasscompact');
        // Can't make mods on readonly single file indexes, so have to compact it into a writable
        xapian.compactToWritableDatabase('compactwritable');
        xapian.closeXapianDatabase();
        xapian.initXapianIndex('compactwritable');
        console.log('Searching for messages in TestFolder (from compact db)');
        let results = xapian.sortedXapianQuery(`folder:"Testfolder"`, 0, 0, 0, 100000, -1);
        equal(results.length, messages.filter(m => m.folder === 'Testfolder').length);

        console.log('number of documents in db before deleting from compact', xapian.getXapianDocCount());
        const beforeCount = xapian.getXapianDocCount();
        console.log('Try deleting messages in Testfolder (from compact db)');
        results.forEach((r, ndx) => {
            const docdata = xapian.getDocumentData(r[0]);
            const dparts = docdata.split('\t');            
            
            const id = parseInt(dparts[0].substring(1), 10);
            xapian.deleteDocumentByUniqueTerm('Q' + id);

            if(ndx%100 === 0) {
                console.log('deleted', ndx, 'messages');
            }            
        });

        console.log('number of documents in db after deleting from compact', xapian.getXapianDocCount());

        const afterCount = xapian.getXapianDocCount();
        equal(afterCount, beforeCount - results.length);

        results = xapian.sortedXapianQuery(`folder:"Testfolder"`, 0, 0, 0, 100000, -1);
        console.log('Testfolder count', results.length);
        equal(results.length, 0);
                
        xapian.closeXapianDatabase();
    }

    @test(timeout(20000)) openafterdeletefromcompactpartition() {
        const xapian = new XapianAPI();
        xapian.initXapianIndex('test');
        xapian.addFolderXapianIndex('compactwritable');
        console.log('number of documents in db after compact', xapian.getXapianDocCount());
        
        const results = xapian.sortedXapianQuery(`folder:"Testfolder"`, 0, 0, 0, 100000, -1);
        console.log('Testfolder count after opening compact after delete', results.length);
        equal(results.length, 0);        
    }    

    @test() flagmessage() {
        const xapian = new XapianAPI();

        let results = xapian.sortedXapianQuery(`flag:flagged`, 0, 0, 0, 100000, -1);
        console.log('Number of flagged messages before flag', results.length);
        equal(results.length, 0);        

        const indexer : IndexingTools = new IndexingTools(xapian);
        const flaggedMessage = messages[0];
        flaggedMessage.flaggedFlag = true;
        indexer.addMessageToIndex(flaggedMessage);

        results = xapian.sortedXapianQuery(`flag:flagged`, 0, 0, 0, 100000, -1);
        console.log('Number of flagged messages after flagging', results.length);
        equal(results.length, 1);       
    }

    @test() answeredmessage() {
        const xapian = new XapianAPI();

        let results = xapian.sortedXapianQuery(`flag:answered`, 0, 0, 0, 100000, -1);
        console.log('Number of flagged messages before answered flag', results.length);
        equal(results.length, 0);        

        const indexer : IndexingTools = new IndexingTools(xapian);
        const flaggedMessage = messages[1];
        flaggedMessage.answeredFlag = true;
        indexer.addMessageToIndex(flaggedMessage);

        results = xapian.sortedXapianQuery(`flag:answered`, 0, 0, 0, 100000, -1);
        console.log('Number of flagged messages after flagging answered', results.length);
        equal(results.length, 1);       
    }

    @test() seenmessage() {
        const xapian = new XapianAPI();

        const seenBeforeChange = xapian.sortedXapianQuery(`flag:seen`, 0, 0, 0, 100000, -1).length;
        console.log('Number of flagged messages before seen flag', seenBeforeChange);

        const indexer : IndexingTools = new IndexingTools(xapian);
        const flaggedMessage = messages[2];
        flaggedMessage.seenFlag = true;
        indexer.addMessageToIndex(flaggedMessage);

        const seenAfterChange = xapian.sortedXapianQuery(`flag:seen`, 0, 0, 0, 100000, -1).length;
        console.log('Number of flagged messages after seen', seenAfterChange);
        equal(seenAfterChange, seenBeforeChange + 1);
    }

    @test() messagewithattachment() {
        const xapian = new XapianAPI();

        let results = xapian.sortedXapianQuery(`flag:attachment`, 0, 0, 0, 100000, -1);
        console.log('Number of attachment messages before seen flag', results.length);
        equal(results.length, 0);        

        const indexer : IndexingTools = new IndexingTools(xapian);
        const flaggedMessage = messages[3];
        flaggedMessage.attachment = true;
        indexer.addMessageToIndex(flaggedMessage);

        results = xapian.sortedXapianQuery(`flag:attachment`, 0, 0, 0, 100000, -1);
        console.log('Number of attachment messages after attachment flag', results.length);
        equal(results.length, 1);       
    }
}
