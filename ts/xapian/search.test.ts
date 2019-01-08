import { suite, test, slow, timeout, only } from 'mocha-typescript';
import { XapianAPI } from 'runbox7lib';
import { equal } from 'assert';
import { loadXapian } from './xapian.loader';
import { MailAddressInfo, MessageInfo, IndexingTools } from 'runbox7lib';


declare var FS, MEMFS, Module;

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

const receivers = [
    [new MailAddressInfo('Receiver', 'receiver@runbox.com')],
    [new MailAddressInfo('Receiver3', 'receiver3@runbox.com'), new MailAddressInfo('Receiver5', 'receiver5@runbox.com')],
    [new MailAddressInfo(null, 'receiver7@runbox.com'),
        // Max term length is 245 bytes - will truncate this long mail address to 200 chars.
        new MailAddressInfo("U+Mq6Timrygmzwmjtjhuzdamjyga2Tcmbrhe2Tqnjxfyys4Qrxgbceemcdgnbtcrbxgyzekojfgqygo5Lon53W4Zlsonqw2Zlsnfrwcltdn5Wsm2B5Gy4Tsztcgntgmzrwmfsdiojzmu4Ggytfmqztgyrtmq4Dgntfmntcm3J5Gu2Tmmjqg44Cm4R5Mrqxm2Leeu2Dazdemfugyltdn5Wq",
            "u+mq6timrygmzwmjtjhuzdamjyga2tcmbrhe2tqnjxfyys4qrxgbceemcdgnbtcrbxgyzekojfgqygo5lon53w4zlsonqw2zlsnfrwcltdn5wsm2b5gy4tsztcgntgmzrwmfsdiojzmu4ggytfmqztgyrtmq4dgntfmntcm3j5gu2tmmjqg44cm4r5mrqxm2leeu2dazdemfugyltdn5wq@gunownersamerica.com")
    ]
]
@suite export class SearchTest {

    static messages = [];

    static before(done) {
        loadXapian().subscribe(() => {            
            console.log('xapian loaded');
            
            FS.mkdir("/searchtestwork");
            FS.mount(MEMFS, {},"/searchtestwork");
            FS.chdir("/searchtestwork");
            
            
            done();
        });                        
    }

    @test() createIndex() {
        const xapian = new XapianAPI();
        xapian.initXapianIndex('mainpartition');
                        
            
        for(let id=1;id<100;id++) {
            const msg = new MessageInfo(id, new Date(id * 6 * 60 * 60 * 1000),
                    new Date(id * 6 * 60 * 60 * 1000),
                'Inbox',
                false,
                false,
                false,
                [new MailAddressInfo('Sender', 'sender@runbox.com')],
                receivers[id % receivers.length],
                [],
                [],
                subjects[id % contents.length],
                contents[id % contents.length],
                100,
                false);
            SearchTest.messages.push(msg);
        }

        const indexer : IndexingTools = new IndexingTools(xapian);
        SearchTest.messages.forEach((msg, ndx) => {
            indexer.addMessageToIndex(msg);
            if(ndx % 500 === 0) {
                console.log('added messages', ndx, 'of', SearchTest.messages.length);
            }
        });
    }

    @test() searchemailaddress() {
        const xapian = new XapianAPI();

        
        global['termlistresult'] = [];
        xapian.termlist("XRECIPIENT:");
        console.log(global['termlistresult']);
        
        let results = xapian.sortedXapianQuery(`to:receive`, 0, 0, 0, 100000, -1);
        equal(SearchTest.messages.length, results.length);

        results = xapian.sortedXapianQuery(`to:receiver@runbox.com`, 0, 0, 0, 100000, -1);
        equal(33, results.length);

        results = xapian.sortedXapianQuery(`to:receiver3@runbox.com`, 0, 0, 0, 100000, -1);
        equal(33, results.length);

        global['termlistresult'] = [];
        const numterms = xapian.termlist('XRECIPIENT:');
        console.log('recipientterms', global['termlistresult']);
        equal(5, numterms);
    }
}