import { execSync } from 'child_process';

import { loadXapian } from '../xapian/xapian.loader';
import { XapianAPI } from '../xapian/rmmxapianapi';
import { IndexingTools, MessageInfo } from '../xapian/messageinfo';
import { MailAddressInfo } from '../xapian/mailaddressinfo';

import { suite, test } from "@testdeck/mocha";
import { equal } from 'assert';


const XAPIANFSTYPE: string = 'MEM';

declare var FS, MEMFS;


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

let addTermToDocument: (idterm: string, termname: string) => void;
let removeTermFromDocument: (idterm: string, termname: string) => void;
let addTextToDocument: (idterm: string, withoutpositions: boolean, text: string) => void;
let getDocIdFromUniqueIdTerm: (idterm: string) => number;

/**
 * Change folder in xapian test
 */
@suite export class ModifyDocTermsTest {
    
    static before(done) {
        loadXapian().subscribe(() => {
            
            console.log('xapian loaded');
            
            FS.mkdir("/modifydoctermstest");
            FS.mount(MEMFS, {},"/modifydoctermstest");
            FS.chdir("/modifydoctermstest");

            addTermToDocument = global['Module'].cwrap('addTermToDocument', null, ['string', 'string']);
            removeTermFromDocument = global['Module'].cwrap('removeTermFromDocument', null, ['string', 'string']);
            addTextToDocument = global['Module'].cwrap('addTextToDocument', null, ['string', 'boolean', 'string']);
            getDocIdFromUniqueIdTerm = global['Module'].cwrap('getDocIdFromUniqueIdTerm', 'number', ['string']);
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
    
    
    @test() modifyTermsInMainPartition() {        
        const xapian = new XapianAPI();
        let results = xapian.sortedXapianQuery(`folder:"Mainpartition"`, 0, 0, 0, 100000, -1);

       results.forEach((r) => {
           const docdata = xapian.getDocumentData(r[0]);
           const idterm = docdata.split("\t")[0];
           addTermToDocument(idterm, 'XFflagged');
       });

       xapian.commitXapianUpdates();
       results = xapian.sortedXapianQuery(`folder:"Mainpartition" AND flag:flagged`, 0, 0, 0, 100000, -1);
       equal(100, results.length);

       results.forEach((r) => {
            const docdata = xapian.getDocumentData(r[0]);
            const idterm = docdata.split("\t")[0];            
            removeTermFromDocument(idterm, 'XFflagged');
        });

       results = xapian.sortedXapianQuery(`folder:"Mainpartition" AND flag:flagged`, 0, 0, 0, 100000, -1);
       equal(0, results.length);       
    }
    
    @test() tryModiyTermInNonexistingDOc() {         
        let failed = false;
        try {
            addTermToDocument('Q7eeCC11', 'XFflagged');       
        } catch(e) {
            failed = true;
        }
        equal(true, failed);
    }

    @test() tryChangingFolderOfNonexistingDoc() {         
        const xapian = new XapianAPI();
        const indexer : IndexingTools = new IndexingTools(xapian);

        let failed = false;
        try {
            xapian.changeDocumentsFolder('Q7eeCC1221', 'NewFolder');       
        } catch(e) {
            failed = true;
        }
        equal(true, failed);

        console.log('Now try adding the document and changing the folder');
        const id = 9087122341;
        const msg = new MessageInfo(id, new Date(),
                new Date(),
                'Otherpartition',
                false,
                false,
                false,
                [new MailAddressInfo('Sender', 'sender@runbox.com')],
                [new MailAddressInfo('Receiver', 'receiver@runbox.com')],
                [],
                [],
                subjects[0],
                contents[0],
                100,
                false);
        indexer.addMessageToIndex(msg);    

        failed = false;
        try {
            xapian.changeDocumentsFolder(`Q${id}`, 'ChangedFolderABC');       
        } catch(e) {
            failed = true;
        }
        equal(false, failed);
        
        let results = xapian.sortedXapianQuery(`folder:"ChangedFolderABC"`, 0, 0, 0, 100000, -1);
        equal(1, results.length);
    }

    @test() modifyTermsInOtherPartition() {        
        const xapian = new XapianAPI();
        let results = xapian.sortedXapianQuery(`folder:"Otherpartition"`, 0, 0, 0, 100000, -1);
        equal(99, results.length);
        results.forEach((r) => {
            const docdata = xapian.getDocumentData(r[0]);
            const idterm = docdata.split("\t")[0];
            addTermToDocument(idterm, 'XFflagged');
        });
 
        xapian.commitXapianUpdates();
        results = xapian.sortedXapianQuery(`folder:"Otherpartition" AND flag:flagged`, 0, 0, 0, 100000, -1);
        equal(99, results.length);
 
        results.forEach((r) => {
             const docdata = xapian.getDocumentData(r[0]);
             const idterm = docdata.split("\t")[0];            
             removeTermFromDocument(idterm, 'XFflagged');
         });
 
        results = xapian.sortedXapianQuery(`folder:"Otherpartition" AND flag:flagged`, 0, 0, 0, 100000, -1);
        equal(0, results.length);       
    }

    @test() addTextInMainPartition() {        
        const xapian = new XapianAPI();

        equal(0, xapian.sortedXapianQuery(`folder:"Mainpartition" AND "xulaxis brequrianis"`, 0, 0, 0, 100000, -1).length);
        let results = xapian.sortedXapianQuery(`folder:"Mainpartition"`, 0, 0, 0, 100000, -1);

       results.forEach((r) => {
           const docdata = xapian.getDocumentData(r[0]);
           const idterm = docdata.split("\t")[0];
           addTextToDocument(idterm, true, 'xulaxis brequrianis');
       });

       xapian.commitXapianUpdates();
       results = xapian.sortedXapianQuery(`folder:"Mainpartition" AND "xulaxis brequrianis"`, 0, 0, 0, 100000, -1);
       equal(100, results.length);

       // Without positioning - goes both ways
       results = xapian.sortedXapianQuery(`folder:"Mainpartition" AND "brequrianis xulaxis"`, 0, 0, 0, 100000, -1);
       equal(100, results.length);
    }
    
    @test() addTextInOtherPartition() {        
        const xapian = new XapianAPI();

        equal(0, xapian.sortedXapianQuery(`folder:"Otherpartition" AND "xulaxis brequrianis"`, 0, 0, 0, 100000, -1).length);
        let results = xapian.sortedXapianQuery(`folder:"Otherpartition"`, 0, 0, 0, 100000, -1);

       results.forEach((r) => {
           const docdata = xapian.getDocumentData(r[0]);
           const idterm = docdata.split("\t")[0];
           addTextToDocument(idterm, false, 'xulaxis brequrianis');
       });

       xapian.commitXapianUpdates();
       results = xapian.sortedXapianQuery(`folder:"Otherpartition" AND "xulaxis brequrianis"`, 0, 0, 0, 100000, -1);
       equal(99, results.length);

       // With positions, must match exact phrase
       results = xapian.sortedXapianQuery(`folder:"Otherpartition" AND "brequrianis xulaxis"`, 0, 0, 0, 100000, -1);
       equal(0, results.length);
    }

    @test() getDocumentByIdTermAndModify() {        
        const xapian = new XapianAPI();
        let results = xapian.sortedXapianQuery(`folder:"Otherpartition"`, 0, 0, 0, 1, -1);
        
        const unique_id_term = xapian.getDocumentData(results[0][0]).split('\t')[0];
        const docid = getDocIdFromUniqueIdTerm(unique_id_term);
        equal(results[0][0], docid);

        xapian.documentXTermList(docid);
        let termlistresult: string[] = global['Module']['documenttermlistresult'];
        equal(1, termlistresult.filter(term => term === 'XFOLDER:Otherpartition').length);
        xapian.changeDocumentsFolder(unique_id_term, 'TestFolder1523');
        
        xapian.documentXTermList(docid);
        termlistresult = global['Module']['documenttermlistresult'];

        equal(1, xapian.sortedXapianQuery(`folder:"TestFolder1523"`, 0, 0, 0, 1, -1).length);
        equal(1, termlistresult.filter(term => term === 'XFOLDER:TestFolder1523').length);
        equal(0, termlistresult.filter(term => term === 'XFOLDER:Otherpartition').length);
    }
}
